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
          life_area_id: string | null;
          name: string;
          color: string;
          sort_order: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          life_area_id?: string | null;
          name: string;
          color: string;
          sort_order?: number | null;
          created_at?: string;
        };
        Update: {
          life_area_id?: string | null;
          name?: string;
          color?: string;
          sort_order?: number | null;
        };
        Relationships: [];
      };
      life_areas: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          icon: string | null;
          description: string | null;
          is_active: boolean;
          sort_order: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string;
          icon?: string | null;
          description?: string | null;
          is_active?: boolean;
          sort_order?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          color?: string;
          icon?: string | null;
          description?: string | null;
          is_active?: boolean;
          sort_order?: number | null;
          updated_at?: string;
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
          input_mode: "ratio" | "measured";
          unit: string | null;
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
          input_mode?: "ratio" | "measured";
          unit?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string | null;
          title?: string;
          description?: string | null;
          weight?: number;
          input_mode?: "ratio" | "measured";
          unit?: string | null;
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
          miss_reason:
            | "no_time"
            | "low_energy"
            | "forgot"
            | "not_important"
            | "overloaded_plan"
            | "health"
            | "other_priorities"
            | "no_conditions"
            | "other"
            | null;
          miss_comment: string | null;
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
          miss_reason?:
            | "no_time"
            | "low_energy"
            | "forgot"
            | "not_important"
            | "overloaded_plan"
            | "health"
            | "other_priorities"
            | "no_conditions"
            | "other"
            | null;
          miss_comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          actual_value?: number;
          actual_score?: number;
          note?: string | null;
          miss_reason?:
            | "no_time"
            | "low_energy"
            | "forgot"
            | "not_important"
            | "overloaded_plan"
            | "health"
            | "other_priorities"
            | "no_conditions"
            | "other"
            | null;
          miss_comment?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      weekly_reviews: {
        Row: {
          id: string;
          user_id: string;
          month_id: string;
          week_number: number;
          start_date: string;
          end_date: string;
          worked_well: string | null;
          didnt_work: string | null;
          blockers: string | null;
          repeat_next: string | null;
          remove_next: string | null;
          lesson: string | null;
          next_week_focus: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month_id: string;
          week_number: number;
          start_date: string;
          end_date: string;
          worked_well?: string | null;
          didnt_work?: string | null;
          blockers?: string | null;
          repeat_next?: string | null;
          remove_next?: string | null;
          lesson?: string | null;
          next_week_focus?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          week_number?: number;
          start_date?: string;
          end_date?: string;
          worked_well?: string | null;
          didnt_work?: string | null;
          blockers?: string | null;
          repeat_next?: string | null;
          remove_next?: string | null;
          lesson?: string | null;
          next_week_focus?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      experiments: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          hypothesis: string | null;
          life_area_id: string | null;
          start_date: string;
          end_date: string;
          status: "draft" | "active" | "completed" | "archived";
          success_metric: string | null;
          result_summary: string | null;
          conclusion: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          hypothesis?: string | null;
          life_area_id?: string | null;
          start_date: string;
          end_date: string;
          status?: "draft" | "active" | "completed" | "archived";
          success_metric?: string | null;
          result_summary?: string | null;
          conclusion?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          hypothesis?: string | null;
          life_area_id?: string | null;
          start_date?: string;
          end_date?: string;
          status?: "draft" | "active" | "completed" | "archived";
          success_metric?: string | null;
          result_summary?: string | null;
          conclusion?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      experiment_checkins: {
        Row: {
          id: string;
          experiment_id: string;
          date: string;
          value: number;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          experiment_id: string;
          date: string;
          value?: number;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          date?: string;
          value?: number;
          note?: string | null;
        };
        Relationships: [];
      };
      life_events: {
        Row: {
          id: string;
          user_id: string;
          life_area_id: string | null;
          goal_id: string | null;
          title: string;
          description: string | null;
          event_date: string;
          type:
            | "achievement"
            | "milestone"
            | "decision"
            | "failure"
            | "recovery"
            | "purchase"
            | "health"
            | "finance"
            | "work"
            | "family"
            | "faith"
            | "custom";
          importance: 1 | 2 | 3 | 4 | 5;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          life_area_id?: string | null;
          goal_id?: string | null;
          title: string;
          description?: string | null;
          event_date: string;
          type?:
            | "achievement"
            | "milestone"
            | "decision"
            | "failure"
            | "recovery"
            | "purchase"
            | "health"
            | "finance"
            | "work"
            | "family"
            | "faith"
            | "custom";
          importance?: 1 | 2 | 3 | 4 | 5;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          life_area_id?: string | null;
          goal_id?: string | null;
          title?: string;
          description?: string | null;
          event_date?: string;
          type?:
            | "achievement"
            | "milestone"
            | "decision"
            | "failure"
            | "recovery"
            | "purchase"
            | "health"
            | "finance"
            | "work"
            | "family"
            | "faith"
            | "custom";
          importance?: 1 | 2 | 3 | 4 | 5;
          updated_at?: string;
        };
        Relationships: [];
      };
      finance_snapshots: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          income: number;
          required_expenses: number;
          optional_expenses: number;
          savings: number;
          debt_total: number;
          investments: number;
          comment: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          income?: number;
          required_expenses?: number;
          optional_expenses?: number;
          savings?: number;
          debt_total?: number;
          investments?: number;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          date?: string;
          income?: number;
          required_expenses?: number;
          optional_expenses?: number;
          savings?: number;
          debt_total?: number;
          investments?: number;
          comment?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      finance_goals: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          target_amount: number;
          current_amount: number;
          due_date: string | null;
          life_area_id: string | null;
          goal_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          target_amount: number;
          current_amount?: number;
          due_date?: string | null;
          life_area_id?: string | null;
          goal_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          target_amount?: number;
          current_amount?: number;
          due_date?: string | null;
          life_area_id?: string | null;
          goal_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      health_logs: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          weight: number | null;
          sleep_hours: number | null;
          energy: number | null;
          mood: string | null;
          pain_level: number | null;
          workout_done: boolean;
          steps: number | null;
          comment: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          weight?: number | null;
          sleep_hours?: number | null;
          energy?: number | null;
          mood?: string | null;
          pain_level?: number | null;
          workout_done?: boolean;
          steps?: number | null;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          date?: string;
          weight?: number | null;
          sleep_hours?: number | null;
          energy?: number | null;
          mood?: string | null;
          pain_level?: number | null;
          workout_done?: boolean;
          steps?: number | null;
          comment?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      cars: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          brand: string | null;
          model: string | null;
          year: number | null;
          current_mileage: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          brand?: string | null;
          model?: string | null;
          year?: number | null;
          current_mileage?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          brand?: string | null;
          model?: string | null;
          year?: number | null;
          current_mileage?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      car_service_items: {
        Row: {
          id: string;
          user_id: string;
          car_id: string;
          name: string;
          system:
            | "engine"
            | "transmission"
            | "transfer_case"
            | "front_diff"
            | "rear_diff"
            | "brakes"
            | "spark_plugs"
            | "filters"
            | "antifreeze"
            | "power_steering"
            | "battery"
            | "tires"
            | "other";
          last_service_date: string | null;
          last_service_mileage: number | null;
          interval_months: number | null;
          interval_km: number | null;
          comment: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          car_id: string;
          name: string;
          system:
            | "engine"
            | "transmission"
            | "transfer_case"
            | "front_diff"
            | "rear_diff"
            | "brakes"
            | "spark_plugs"
            | "filters"
            | "antifreeze"
            | "power_steering"
            | "battery"
            | "tires"
            | "other";
          last_service_date?: string | null;
          last_service_mileage?: number | null;
          interval_months?: number | null;
          interval_km?: number | null;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          car_id?: string;
          name?: string;
          system?:
            | "engine"
            | "transmission"
            | "transfer_case"
            | "front_diff"
            | "rear_diff"
            | "brakes"
            | "spark_plugs"
            | "filters"
            | "antifreeze"
            | "power_steering"
            | "battery"
            | "tires"
            | "other";
          last_service_date?: string | null;
          last_service_mileage?: number | null;
          interval_months?: number | null;
          interval_km?: number | null;
          comment?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      car_service_logs: {
        Row: {
          id: string;
          user_id: string;
          car_id: string;
          service_item_id: string | null;
          service_date: string;
          mileage: number;
          cost: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          car_id: string;
          service_item_id?: string | null;
          service_date: string;
          mileage: number;
          cost?: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          service_item_id?: string | null;
          service_date?: string;
          mileage?: number;
          cost?: number;
          comment?: string | null;
        };
        Relationships: [];
      };
      work_projects: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          status: "active" | "paused" | "completed" | "archived";
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
          status?: "active" | "paused" | "completed" | "archived";
          start_date?: string | null;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          status?: "active" | "paused" | "completed" | "archived";
          start_date?: string | null;
          due_date?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      work_cases: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          problem: string | null;
          actions: string | null;
          result: string | null;
          metrics_before: string | null;
          metrics_after: string | null;
          conclusion: string | null;
          skills: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          problem?: string | null;
          actions?: string | null;
          result?: string | null;
          metrics_before?: string | null;
          metrics_after?: string | null;
          conclusion?: string | null;
          skills?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          problem?: string | null;
          actions?: string | null;
          result?: string | null;
          metrics_before?: string | null;
          metrics_after?: string | null;
          conclusion?: string | null;
          skills?: string[];
          updated_at?: string;
        };
        Relationships: [];
      };
      work_skills: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          level: number;
          target_level: number;
          comment: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          level?: number;
          target_level?: number;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          level?: number;
          target_level?: number;
          comment?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          life_area_id: string | null;
          title: string;
          description: string | null;
          type: "long_term" | "monthly" | "weekly";
          status: "active" | "completed" | "paused" | "archived";
          priority: "low" | "medium" | "high";
          why_text: string | null;
          target_value: number | null;
          current_value: number | null;
          unit: string | null;
          desired_identity: string | null;
          progress_mode: "linked_tasks" | "manual_value" | "mixed";
          start_date: string | null;
          due_date: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          life_area_id?: string | null;
          title: string;
          description?: string | null;
          type?: "long_term" | "monthly" | "weekly";
          status?: "active" | "completed" | "paused" | "archived";
          priority?: "low" | "medium" | "high";
          why_text?: string | null;
          target_value?: number | null;
          current_value?: number | null;
          unit?: string | null;
          desired_identity?: string | null;
          progress_mode?: "linked_tasks" | "manual_value" | "mixed";
          start_date?: string | null;
          due_date?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          life_area_id?: string | null;
          title?: string;
          description?: string | null;
          type?: "long_term" | "monthly" | "weekly";
          status?: "active" | "completed" | "paused" | "archived";
          priority?: "low" | "medium" | "high";
          why_text?: string | null;
          target_value?: number | null;
          current_value?: number | null;
          unit?: string | null;
          desired_identity?: string | null;
          progress_mode?: "linked_tasks" | "manual_value" | "mixed";
          start_date?: string | null;
          due_date?: string | null;
          completed_at?: string | null;
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
          onboarding_completed_at: string | null;
          onboarding_mode: "recovery" | "normal" | "push";
          onboarding_blockers: string[];
          desired_identity: string | null;
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
          onboarding_completed_at?: string | null;
          onboarding_mode?: "recovery" | "normal" | "push";
          onboarding_blockers?: string[];
          desired_identity?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          daily_reminder_enabled?: boolean;
          daily_reminder_time?: string;
          risk_alerts_enabled?: boolean;
          theme?: "light" | "dark" | "system";
          default_month_target?: number;
          onboarding_completed_at?: string | null;
          onboarding_mode?: "recovery" | "normal" | "push";
          onboarding_blockers?: string[];
          desired_identity?: string | null;
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
      team_goals: {
        Row: {
          id: string;
          team_id: string;
          created_by: string;
          title: string;
          description: string | null;
          unit: string;
          target_value: number;
          status: "active" | "completed" | "archived";
          start_date: string | null;
          due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          created_by: string;
          title: string;
          description?: string | null;
          unit?: string;
          target_value: number;
          status?: "active" | "completed" | "archived";
          start_date?: string | null;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          unit?: string;
          target_value?: number;
          status?: "active" | "completed" | "archived";
          start_date?: string | null;
          due_date?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_goal_contributions: {
        Row: {
          id: string;
          goal_id: string;
          user_id: string;
          value: number;
          note: string | null;
          date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          goal_id: string;
          user_id: string;
          value: number;
          note?: string | null;
          date?: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      team_challenges: {
        Row: {
          id: string;
          team_id: string;
          created_by: string;
          title: string;
          description: string | null;
          unit: string;
          target_value: number;
          status: "draft" | "active" | "completed" | "archived";
          start_date: string | null;
          due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          created_by: string;
          title: string;
          description?: string | null;
          unit?: string;
          target_value: number;
          status?: "draft" | "active" | "completed" | "archived";
          start_date?: string | null;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          unit?: string;
          target_value?: number;
          status?: "draft" | "active" | "completed" | "archived";
          start_date?: string | null;
          due_date?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_challenge_checkins: {
        Row: {
          id: string;
          challenge_id: string;
          user_id: string;
          value: number;
          note: string | null;
          date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          challenge_id: string;
          user_id: string;
          value: number;
          note?: string | null;
          date?: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      team_boards: {
        Row: {
          id: string;
          team_id: string;
          created_by: string;
          title: string;
          description: string | null;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          created_by: string;
          title: string;
          description?: string | null;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          is_archived?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_board_columns: {
        Row: {
          id: string;
          board_id: string;
          title: string;
          color: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          board_id: string;
          title: string;
          color?: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          title?: string;
          color?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      team_board_tasks: {
        Row: {
          id: string;
          board_id: string;
          column_id: string;
          created_by: string;
          assignee_id: string | null;
          title: string;
          description: string | null;
          priority: "low" | "medium" | "high" | "urgent";
          due_date: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          board_id: string;
          column_id: string;
          created_by: string;
          assignee_id?: string | null;
          title: string;
          description?: string | null;
          priority?: "low" | "medium" | "high" | "urgent";
          due_date?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          column_id?: string;
          assignee_id?: string | null;
          title?: string;
          description?: string | null;
          priority?: "low" | "medium" | "high" | "urgent";
          due_date?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_board_comments: {
        Row: {
          id: string;
          task_id: string;
          author_id: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          author_id: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          content?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      personal_boards: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          is_default: boolean;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          is_default?: boolean;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          is_default?: boolean;
          is_archived?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      personal_board_columns: {
        Row: {
          id: string;
          user_id: string;
          board_id: string;
          title: string;
          color: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          board_id: string;
          title: string;
          color?: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          title?: string;
          color?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      personal_board_tasks: {
        Row: {
          id: string;
          user_id: string;
          board_id: string;
          column_id: string;
          title: string;
          description: string | null;
          priority: "low" | "medium" | "high" | "urgent";
          due_date: string | null;
          goal_id: string | null;
          habit_task_id: string | null;
          month_id: string | null;
          sort_order: number;
          is_archived: boolean;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          board_id: string;
          column_id: string;
          title: string;
          description?: string | null;
          priority?: "low" | "medium" | "high" | "urgent";
          due_date?: string | null;
          goal_id?: string | null;
          habit_task_id?: string | null;
          month_id?: string | null;
          sort_order?: number;
          is_archived?: boolean;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          column_id?: string;
          title?: string;
          description?: string | null;
          priority?: "low" | "medium" | "high" | "urgent";
          due_date?: string | null;
          goal_id?: string | null;
          habit_task_id?: string | null;
          month_id?: string | null;
          sort_order?: number;
          is_archived?: boolean;
          completed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      personal_board_comments: {
        Row: {
          id: string;
          user_id: string;
          task_id: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          content?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notification_settings: {
        Row: {
          id: string;
          user_id: string;
          enabled: boolean;
          evening_reminder_time: string;
          remind_deadline_1d: boolean;
          remind_deadline_3d: boolean;
          remind_overdue: boolean;
          remind_weekly_review: boolean;
          quiet_mode: boolean;
          reminder_weekdays: number[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          enabled?: boolean;
          evening_reminder_time?: string;
          remind_deadline_1d?: boolean;
          remind_deadline_3d?: boolean;
          remind_overdue?: boolean;
          remind_weekly_review?: boolean;
          quiet_mode?: boolean;
          reminder_weekdays?: number[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          enabled?: boolean;
          evening_reminder_time?: string;
          remind_deadline_1d?: boolean;
          remind_deadline_3d?: boolean;
          remind_overdue?: boolean;
          remind_weekly_review?: boolean;
          quiet_mode?: boolean;
          reminder_weekdays?: number[];
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type:
            | "due_today"
            | "due_tomorrow"
            | "due_3_days"
            | "overdue"
            | "today_fact_missing"
            | "yesterday_not_closed"
            | "stale_goal_progress"
            | "weak_life_area"
            | "weekly_review_due"
            | "monthly_plan_update_due"
            | "team_challenge_ending"
            | "system";
          title: string;
          body: string | null;
          entity_type: string | null;
          entity_id: string | null;
          action_url: string | null;
          status: "unread" | "read" | "dismissed";
          scheduled_for: string | null;
          dedupe_key: string;
          created_at: string;
          read_at: string | null;
          dismissed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          type:
            | "due_today"
            | "due_tomorrow"
            | "due_3_days"
            | "overdue"
            | "today_fact_missing"
            | "yesterday_not_closed"
            | "stale_goal_progress"
            | "weak_life_area"
            | "weekly_review_due"
            | "monthly_plan_update_due"
            | "team_challenge_ending"
            | "system";
          title: string;
          body?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          action_url?: string | null;
          status?: "unread" | "read" | "dismissed";
          scheduled_for?: string | null;
          dedupe_key: string;
          created_at?: string;
          read_at?: string | null;
          dismissed_at?: string | null;
        };
        Update: {
          title?: string;
          body?: string | null;
          action_url?: string | null;
          status?: "unread" | "read" | "dismissed";
          scheduled_for?: string | null;
          read_at?: string | null;
          dismissed_at?: string | null;
        };
        Relationships: [];
      };
      activity_events: {
        Row: {
          id: string;
          user_id: string;
          entity_type: string;
          entity_id: string | null;
          action: string;
          title: string;
          description: string | null;
          occurred_at: string;
          metadata: Json;
          visibility: "private" | "team";
        };
        Insert: {
          id?: string;
          user_id: string;
          entity_type: string;
          entity_id?: string | null;
          action: string;
          title: string;
          description?: string | null;
          occurred_at?: string;
          metadata?: Json;
          visibility?: "private" | "team";
        };
        Update: {
          title?: string;
          description?: string | null;
          occurred_at?: string;
          metadata?: Json;
          visibility?: "private" | "team";
        };
        Relationships: [];
      };
      day_summaries: {
        Row: {
          id: string;
          user_id: string;
          month_id: string;
          date: string;
          planned_count: number;
          done_count: number;
          partial_count: number;
          overdone_count: number;
          missed_count: number;
          missing_fact_count: number;
          plan_score: number;
          fact_score: number;
          completion: number;
          main_miss_reason: string | null;
          note: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month_id: string;
          date: string;
          planned_count?: number;
          done_count?: number;
          partial_count?: number;
          overdone_count?: number;
          missed_count?: number;
          missing_fact_count?: number;
          plan_score?: number;
          fact_score?: number;
          completion?: number;
          main_miss_reason?: string | null;
          note?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          planned_count?: number;
          done_count?: number;
          partial_count?: number;
          overdone_count?: number;
          missed_count?: number;
          missing_fact_count?: number;
          plan_score?: number;
          fact_score?: number;
          completion?: number;
          main_miss_reason?: string | null;
          note?: string | null;
          metadata?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      focus_sessions: {
        Row: {
          id: string;
          user_id: string;
          task_id: string | null;
          started_at: string;
          ended_at: string | null;
          duration_minutes: number | null;
          note: string | null;
          outcome: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id?: string | null;
          started_at: string;
          ended_at?: string | null;
          duration_minutes?: number | null;
          note?: string | null;
          outcome?: string | null;
          created_at?: string;
        };
        Update: {
          task_id?: string | null;
          started_at?: string;
          ended_at?: string | null;
          duration_minutes?: number | null;
          note?: string | null;
          outcome?: string | null;
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
