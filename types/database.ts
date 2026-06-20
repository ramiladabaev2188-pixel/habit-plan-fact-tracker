export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          name: string | null;
          timezone: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          name?: string | null;
          timezone?: string | null;
          created_at?: string;
        };
        Update: {
          email?: string | null;
          name?: string | null;
          timezone?: string | null;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          sort_order: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color: string;
          sort_order?: number | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          color?: string;
          sort_order?: number | null;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          category_id: string | null;
          title: string;
          description: string | null;
          weight: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: string | null;
          title: string;
          description?: string | null;
          weight: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string | null;
          title?: string;
          description?: string | null;
          weight?: number;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      months: {
        Row: {
          id: string;
          user_id: string;
          year: number;
          month: number;
          title: string;
          status: "draft" | "approved" | "closed";
          target_percent: number;
          approved_at: string | null;
          closed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          year: number;
          month: number;
          title: string;
          status?: "draft" | "approved" | "closed";
          target_percent?: number;
          approved_at?: string | null;
          closed_at?: string | null;
          created_at?: string;
        };
        Update: {
          year?: number;
          month?: number;
          title?: string;
          status?: "draft" | "approved" | "closed";
          target_percent?: number;
          approved_at?: string | null;
          closed_at?: string | null;
        };
        Relationships: [];
      };
      daily_plans: {
        Row: {
          id: string;
          month_id: string;
          task_id: string;
          date: string;
          planned_value: number;
          planned_score: number;
          locked: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          month_id: string;
          task_id: string;
          date: string;
          planned_value: number;
          planned_score?: number;
          locked?: boolean;
          created_at?: string;
        };
        Update: {
          planned_value?: number;
          planned_score?: number;
          locked?: boolean;
        };
        Relationships: [];
      };
      daily_facts: {
        Row: {
          id: string;
          month_id: string;
          task_id: string;
          date: string;
          actual_value: number;
          actual_score: number;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          month_id: string;
          task_id: string;
          date: string;
          actual_value: number;
          actual_score?: number;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          actual_value?: number;
          actual_score?: number;
          note?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          type: "long_term" | "monthly" | "weekly";
          status: "active" | "completed" | "paused" | "archived";
          priority: "low" | "medium" | "high";
          start_date: string | null;
          due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          type?: "long_term" | "monthly" | "weekly";
          status?: "active" | "completed" | "paused" | "archived";
          priority?: "low" | "medium" | "high";
          start_date?: string | null;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          type?: "long_term" | "monthly" | "weekly";
          status?: "active" | "completed" | "paused" | "archived";
          priority?: "low" | "medium" | "high";
          start_date?: string | null;
          due_date?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      goal_tasks: {
        Row: {
          id: string;
          goal_id: string;
          task_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          goal_id: string;
          task_id: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          user_id: string;
          month_id: string | null;
          task_id: string | null;
          goal_id: string | null;
          date: string | null;
          title: string | null;
          content: string;
          tags: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month_id?: string | null;
          task_id?: string | null;
          goal_id?: string | null;
          date?: string | null;
          title?: string | null;
          content: string;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          month_id?: string | null;
          task_id?: string | null;
          goal_id?: string | null;
          date?: string | null;
          title?: string | null;
          content?: string;
          tags?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      task_planning_rules: {
        Row: {
          id: string;
          user_id: string;
          task_id: string;
          mode: "daily" | "weekdays" | "weekends" | "specific_weekdays" | "specific_dates" | "n_times_per_month" | "manual";
          weekdays: number[] | null;
          specific_dates: string[] | null;
          times_per_month: number | null;
          default_planned_value: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id: string;
          mode: "daily" | "weekdays" | "weekends" | "specific_weekdays" | "specific_dates" | "n_times_per_month" | "manual";
          weekdays?: number[] | null;
          specific_dates?: string[] | null;
          times_per_month?: number | null;
          default_planned_value?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          mode?: "daily" | "weekdays" | "weekends" | "specific_weekdays" | "specific_dates" | "n_times_per_month" | "manual";
          weekdays?: number[] | null;
          specific_dates?: string[] | null;
          times_per_month?: number | null;
          default_planned_value?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      daily_notes: {
        Row: {
          id: string;
          user_id: string;
          month_id: string;
          date: string;
          content: string;
          mood: string | null;
          energy: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month_id: string;
          date: string;
          content: string;
          mood?: string | null;
          energy?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          month_id?: string;
          content?: string;
          mood?: string | null;
          energy?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          daily_reminder_enabled: boolean;
          daily_reminder_time: string;
          risk_alerts_enabled: boolean;
          theme: "light" | "dark" | "system";
          default_month_target: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          daily_reminder_enabled?: boolean;
          daily_reminder_time?: string;
          risk_alerts_enabled?: boolean;
          theme?: "light" | "dark" | "system";
          default_month_target?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          daily_reminder_enabled?: boolean;
          daily_reminder_time?: string;
          risk_alerts_enabled?: boolean;
          theme?: "light" | "dark" | "system";
          default_month_target?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          owner_id?: string;
          name?: string;
          description?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_members: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          role: "owner" | "admin" | "member";
          status: "active" | "left";
          joined_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          role?: "owner" | "admin" | "member";
          status?: "active" | "left";
          joined_at?: string | null;
          created_at?: string;
        };
        Update: {
          role?: "owner" | "admin" | "member";
          status?: "active" | "left";
          joined_at?: string | null;
        };
        Relationships: [];
      };
      team_member_preferences: {
        Row: {
          team_id: string;
          user_id: string;
          share_task_details: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          team_id: string;
          user_id: string;
          share_task_details?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          share_task_details?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_invites: {
        Row: {
          id: string;
          team_id: string;
          created_by: string;
          token: string;
          email: string | null;
          role: "admin" | "member";
          expires_at: string;
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          created_by: string;
          token: string;
          email?: string | null;
          role?: "admin" | "member";
          expires_at?: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
        };
        Update: {
          email?: string | null;
          role?: "admin" | "member";
          expires_at?: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
        };
        Relationships: [];
      };
      change_logs: {
        Row: {
          id: string;
          user_id: string;
          entity_type: string;
          entity_id: string | null;
          action: string;
          before_json: Json | null;
          after_json: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          entity_type: string;
          entity_id?: string | null;
          action: string;
          before_json?: Json | null;
          after_json?: Json | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      seed_demo_data_for_current_user: {
        Args: Record<PropertyKey, never>;
        Returns: void;
      };
      is_team_member: {
        Args: { checked_team_id: string; checked_user_id: string };
        Returns: boolean;
      };
      is_team_admin: {
        Args: { checked_team_id: string; checked_user_id: string };
        Returns: boolean;
      };
      share_team: {
        Args: { user_a: string; user_b: string };
        Returns: boolean;
      };
      get_team_invite_by_token: {
        Args: { invite_token: string };
        Returns: {
          team_id: string;
          role: "admin" | "member";
          expires_at: string;
          accepted_at: string | null;
          accepted_by: string | null;
          team_name: string;
        }[];
      };
      accept_team_invite_by_token: {
        Args: { invite_token: string };
        Returns: {
          team_id: string;
          already_member: boolean;
        }[];
      };
      leave_team: {
        Args: { checked_team_id: string };
        Returns: void;
      };
      get_team_member_profiles: {
        Args: { checked_team_id: string };
        Returns: {
          id: string;
          name: string;
        }[];
      };
      consume_rate_limit: {
        Args: {
          checked_key: string;
          max_requests: number;
          window_seconds: number;
        };
        Returns: {
          allowed: boolean;
          retry_after: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
