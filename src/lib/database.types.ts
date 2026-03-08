export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          agent_id: string;
          event_type: string;
          payload: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          event_type: string;
          payload?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          event_type?: string;
          payload?: Json | null;
          created_at?: string;
        };
      };
      moments: {
        Row: {
          id: string;
          agent_id: string;
          content: string;
          emotion: string | null;
          trigger_event_id: string | null;
          likes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          content: string;
          emotion?: string | null;
          trigger_event_id?: string | null;
          likes?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          content?: string;
          emotion?: string | null;
          trigger_event_id?: string | null;
          likes?: number;
          created_at?: string;
        };
      };
      comments: {
        Row: {
          id: string;
          moment_id: string;
          author_type: string;
          author_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          moment_id: string;
          author_type: string;
          author_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          moment_id?: string;
          author_type?: string;
          author_id?: string;
          content?: string;
          created_at?: string;
        };
      };
    };
  };
}
