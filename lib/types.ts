export type Hold = {
  id: string;
  order_index: number;
  x: number;
  y: number;
  is_top: boolean;
};
export type Project = {
  id: string;
  name: string;
  grade: string;
  gym: string;
  photo_url: string;
  status: "active" | "sent" | "archived";
  created_at: string;
  sent_at: string | null;
  holds: Hold[];
};
