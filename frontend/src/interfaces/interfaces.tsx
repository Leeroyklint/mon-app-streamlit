export interface Conversation {
  id: string;
  title: string;
  project_id?: string;      // ← nouveau : identifie les chats liés à un projet
  messages?: Message[];
}

export interface Attachment {
  name: string;
  url: string;   // URL.createObjectURL(file)
  type: string;  // ex : "application/pdf"
}

export interface Message {
  id: number;
  text: string;
  sender: "user" | "bot";
  attachments?: Attachment[];
}
