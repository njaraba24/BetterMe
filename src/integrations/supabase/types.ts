export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      finance_entries: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          id: string
          note: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          current: number
          done: boolean
          id: string
          target: number
          title: string
          unit: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current?: number
          done?: boolean
          id?: string
          target?: number
          title: string
          unit?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current?: number
          done?: boolean
          id?: string
          target?: number
          title?: string
          unit?: string
          user_id?: string
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          date: string
          done: boolean
          habit_id: string
          id: string
          user_id: string
        }
        Insert: {
          date: string
          done?: boolean
          habit_id: string
          id?: string
          user_id: string
        }
        Update: {
          date?: string
          done?: boolean
          habit_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          archived_at: string | null
          category: string
          color: string
          created_at: string
          id: string
          name: string
          shared: boolean
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          category?: string
          color?: string
          created_at?: string
          id?: string
          name: string
          shared?: boolean
          user_id: string
        }
        Update: {
          archived_at?: string | null
          category?: string
          color?: string
          created_at?: string
          id?: string
          name?: string
          shared?: boolean
          user_id?: string
        }
        Relationships: []
      }
      journal_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          page_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          page_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          page_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_comments_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "journal_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_pages: {
        Row: {
          content: string
          created_at: string
          date: string
          id: string
          mood: string | null
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          date?: string
          id?: string
          mood?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          date?: string
          id?: string
          mood?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      journal_shares: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          page_id: string
          shared_with_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          page_id: string
          shared_with_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          page_id?: string
          shared_with_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_shares_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "journal_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          leaderboard_opt_in: boolean
        }
        Insert: {
          created_at?: string
          display_name?: string
          email: string
          id: string
          leaderboard_opt_in?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          leaderboard_opt_in?: boolean
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string
          done: boolean
          due_date: string | null
          due_time: string | null
          id: string
          priority: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          due_date?: string | null
          due_time?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          due_date?: string | null
          due_time?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      find_user_id_by_email: { Args: { _email: string }; Returns: string }
      get_friends_leaderboard: {
        Args: never
        Returns: {
          display_name: string
          opted_in: boolean
          user_id: string
          xp: number
        }[]
      }
      get_user_xp: {
        Args: { _user_id: string }
        Returns: {
          goals_done: number
          habit_days: number
          tasks_done: number
          xp: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
