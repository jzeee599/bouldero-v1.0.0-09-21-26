import { createClient } from "@supabase/supabase-js";
import type { Project } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const cloudEnabled = Boolean(url && key);
const supabase = cloudEnabled ? createClient(url!, key!) : null;
type StoredProject = Project & { photo: Blob };

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("bouldero-v1", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("projects", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "Local storage is unavailable. Check your browser storage settings.",
        ),
      );
  });
}
async function localRequest<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction("projects", mode);
    let request: IDBRequest<T>;
    try {
      request = action(transaction.objectStore("projects"));
    } catch (error) {
      db.close();
      reject(error);
      return;
    }
    // Report success only when the transaction is durably committed.
    transaction.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    transaction.onerror = transaction.onabort = () => {
      db.close();
      reject(
        new Error(
          "Could not save locally. Your browser may be out of storage.",
        ),
      );
    };
  });
}
async function owner() {
  const { data, error } = await supabase!.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session.user.id;
  const result = await supabase!.auth.signInAnonymously();
  if (result.error)
    throw new Error(
      `Could not start your private workspace. Enable anonymous sign-ins in Supabase. ${result.error.message}`,
    );
  return result.data.user!.id;
}
export async function listProjects(): Promise<Project[]> {
  if (!supabase) {
    const rows = await localRequest<StoredProject[]>("readonly", (store) =>
      store.getAll(),
    );
    return rows
      .map(({ photo, ...project }) => ({
        ...project,
        photo_url: URL.createObjectURL(photo),
      }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  await owner();
  const { data, error } = await supabase
    .from("projects")
    .select("*, holds(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return Promise.all(
    data.map(async (row) => {
      const { data: photo, error } = await supabase.storage
        .from("project-photos")
        .createSignedUrl(row.photo_url, 86400);
      if (error) throw error;
      return {
        ...row,
        grade: row.grade || "",
        gym: row.gym || "",
        photo_url: photo.signedUrl,
        holds: row.holds.sort(
          (a: Project["holds"][number], b: Project["holds"][number]) =>
            a.order_index - b.order_index,
        ),
      } as Project;
    }),
  );
}
export async function saveProject(
  project: Project,
  photo: Blob,
): Promise<void> {
  if (!supabase) {
    await localRequest("readwrite", (store) =>
      store.put({ ...project, photo_url: "", photo }),
    );
    return;
  }
  const userId = await owner();
  const path = `${userId}/${project.id}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("project-photos")
    .upload(path, photo, { contentType: "image/jpeg", upsert: false });
  if (uploadError) throw uploadError;
  // The RPC inserts the project and all holds in one database transaction.
  const { error } = await supabase.rpc("create_project", {
    p_id: project.id,
    p_name: project.name,
    p_grade: project.grade,
    p_gym: project.gym,
    p_photo: path,
    p_holds: project.holds,
  });
  if (error) {
    await supabase.storage.from("project-photos").remove([path]);
    throw error;
  }
}
