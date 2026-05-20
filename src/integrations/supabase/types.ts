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
      analytics_snapshots: {
        Row: {
          created_at: string
          id: string
          payload: Json
          project_id: string
          snapshot_date: string
          source: Database["public"]["Enums"]["integration_provider"]
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          project_id: string
          snapshot_date: string
          source: Database["public"]["Enums"]["integration_provider"]
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          project_id?: string
          snapshot_date?: string
          source?: Database["public"]["Enums"]["integration_provider"]
        }
        Relationships: [
          {
            foreignKeyName: "analytics_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      app_metrics: {
        Row: {
          active_users: number
          anr_rate: number
          avg_rating: number
          crash_rate: number
          created_at: string
          dau: number
          id: string
          install_conversion_rate: number
          installs: number
          mau: number
          metadata: Json
          metric_date: string
          organic_installs: number
          project_id: string
          retention_rate: number
          sessions: number
          store_visitors: number
          uninstalls: number
        }
        Insert: {
          active_users?: number
          anr_rate?: number
          avg_rating?: number
          crash_rate?: number
          created_at?: string
          dau?: number
          id?: string
          install_conversion_rate?: number
          installs?: number
          mau?: number
          metadata?: Json
          metric_date: string
          organic_installs?: number
          project_id: string
          retention_rate?: number
          sessions?: number
          store_visitors?: number
          uninstalls?: number
        }
        Update: {
          active_users?: number
          anr_rate?: number
          avg_rating?: number
          crash_rate?: number
          created_at?: string
          dau?: number
          id?: string
          install_conversion_rate?: number
          installs?: number
          mau?: number
          metadata?: Json
          metric_date?: string
          organic_installs?: number
          project_id?: string
          retention_rate?: number
          sessions?: number
          store_visitors?: number
          uninstalls?: number
        }
        Relationships: [
          {
            foreignKeyName: "app_metrics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          active_users: number
          avg_engagement_time: number
          bounce_rate: number
          created_at: string
          device_category: string | null
          engaged_sessions: number
          engagement_rate: number
          event_count: number
          id: string
          metric_date: string
          new_users: number
          operating_system: string | null
          project_id: string
        }
        Insert: {
          active_users?: number
          avg_engagement_time?: number
          bounce_rate?: number
          created_at?: string
          device_category?: string | null
          engaged_sessions?: number
          engagement_rate?: number
          event_count?: number
          id?: string
          metric_date: string
          new_users?: number
          operating_system?: string | null
          project_id: string
        }
        Update: {
          active_users?: number
          avg_engagement_time?: number
          bounce_rate?: number
          created_at?: string
          device_category?: string | null
          engaged_sessions?: number
          engagement_rate?: number
          event_count?: number
          id?: string
          metric_date?: string
          new_users?: number
          operating_system?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          event_count: number
          event_name: string
          id: string
          metric_date: string
          project_id: string
          users: number
        }
        Insert: {
          created_at?: string
          event_count?: number
          event_name: string
          id?: string
          metric_date: string
          project_id: string
          users?: number
        }
        Update: {
          created_at?: string
          event_count?: number
          event_name?: string
          id?: string
          metric_date?: string
          project_id?: string
          users?: number
        }
        Relationships: [
          {
            foreignKeyName: "events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      firebase_apps: {
        Row: {
          app_name: string | null
          created_at: string
          firebase_app_id: string
          id: string
          integration_id: string
          platform: string | null
          project_id: string
        }
        Insert: {
          app_name?: string | null
          created_at?: string
          firebase_app_id: string
          id?: string
          integration_id: string
          platform?: string | null
          project_id: string
        }
        Update: {
          app_name?: string | null
          created_at?: string
          firebase_app_id?: string
          id?: string
          integration_id?: string
          platform?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "firebase_apps_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firebase_apps_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ga4_properties: {
        Row: {
          created_at: string
          currency_code: string | null
          id: string
          integration_id: string
          project_id: string
          property_id: string
          property_name: string | null
          timezone: string | null
        }
        Insert: {
          created_at?: string
          currency_code?: string | null
          id?: string
          integration_id: string
          project_id: string
          property_id: string
          property_name?: string | null
          timezone?: string | null
        }
        Update: {
          created_at?: string
          currency_code?: string | null
          id?: string
          integration_id?: string
          project_id?: string
          property_id?: string
          property_name?: string | null
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ga4_properties_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ga4_properties_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      geography: {
        Row: {
          city: string | null
          country: string | null
          country_code: string | null
          created_at: string
          engagement_rate: number
          id: string
          metric_date: string
          project_id: string
          sessions: number
          users: number
        }
        Insert: {
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          engagement_rate?: number
          id?: string
          metric_date: string
          project_id: string
          sessions?: number
          users?: number
        }
        Update: {
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          engagement_rate?: number
          id?: string
          metric_date?: string
          project_id?: string
          sessions?: number
          users?: number
        }
        Relationships: [
          {
            foreignKeyName: "geography_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          account_label: string | null
          created_at: string
          created_by: string
          id: string
          last_synced_at: string | null
          metadata: Json
          organization_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          refresh_token_secret_name: string | null
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
        }
        Insert: {
          account_label?: string | null
          created_at?: string
          created_by: string
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          organization_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          refresh_token_secret_name?: string | null
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Update: {
          account_label?: string | null
          created_at?: string
          created_by?: string
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          organization_id?: string
          provider?: Database["public"]["Enums"]["integration_provider"]
          refresh_token_secret_name?: string | null
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      play_console_apps: {
        Row: {
          app_name: string | null
          created_at: string
          developer_account: string | null
          id: string
          integration_id: string
          last_synced_at: string | null
          package_name: string
          project_id: string
        }
        Insert: {
          app_name?: string | null
          created_at?: string
          developer_account?: string | null
          id?: string
          integration_id: string
          last_synced_at?: string | null
          package_name: string
          project_id: string
        }
        Update: {
          app_name?: string | null
          created_at?: string
          developer_account?: string | null
          id?: string
          integration_id?: string
          last_synced_at?: string | null
          package_name?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "play_console_apps_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "play_console_apps_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          icon_url: string | null
          id: string
          name: string
          organization_id: string
          project_type: Database["public"]["Enums"]["project_type"]
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          icon_url?: string | null
          id?: string
          name: string
          organization_id: string
          project_type?: Database["public"]["Enums"]["project_type"]
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          name?: string
          organization_id?: string
          project_type?: Database["public"]["Enums"]["project_type"]
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      top_pages: {
        Row: {
          active_users: number
          avg_engagement_time: number
          bounce_rate: number
          created_at: string
          engagement_rate: number
          id: string
          metric_date: string
          new_users: number
          page_path: string
          pageviews: number
          project_id: string
          returning_users: number
          sessions: number
          total_users: number
        }
        Insert: {
          active_users?: number
          avg_engagement_time?: number
          bounce_rate?: number
          created_at?: string
          engagement_rate?: number
          id?: string
          metric_date: string
          new_users?: number
          page_path: string
          pageviews?: number
          project_id: string
          returning_users?: number
          sessions?: number
          total_users?: number
        }
        Update: {
          active_users?: number
          avg_engagement_time?: number
          bounce_rate?: number
          created_at?: string
          engagement_rate?: number
          id?: string
          metric_date?: string
          new_users?: number
          page_path?: string
          pageviews?: number
          project_id?: string
          returning_users?: number
          sessions?: number
          total_users?: number
        }
        Relationships: [
          {
            foreignKeyName: "top_pages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      traffic_sources: {
        Row: {
          avg_engagement_time_per_session: number
          bounce_rate: number
          created_at: string
          engaged_sessions: number
          engagement_rate: number
          event_count: number
          events_per_session: number
          id: string
          metric_date: string
          project_id: string
          sessions: number
          source: string
        }
        Insert: {
          avg_engagement_time_per_session?: number
          bounce_rate?: number
          created_at?: string
          engaged_sessions?: number
          engagement_rate?: number
          event_count?: number
          events_per_session?: number
          id?: string
          metric_date: string
          project_id: string
          sessions?: number
          source: string
        }
        Update: {
          avg_engagement_time_per_session?: number
          bounce_rate?: number
          created_at?: string
          engaged_sessions?: number
          engagement_rate?: number
          event_count?: number
          events_per_session?: number
          id?: string
          metric_date?: string
          project_id?: string
          sessions?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "traffic_sources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      website_metrics: {
        Row: {
          active_users: number
          avg_engagement_time: number
          bounce_rate: number
          created_at: string
          engagement_rate: number
          event_count: number
          id: string
          metric_date: string
          new_users: number
          organic_traffic: number
          project_id: string
          returning_users: number
          sessions: number
          total_users: number
        }
        Insert: {
          active_users?: number
          avg_engagement_time?: number
          bounce_rate?: number
          created_at?: string
          engagement_rate?: number
          event_count?: number
          id?: string
          metric_date: string
          new_users?: number
          organic_traffic?: number
          project_id: string
          returning_users?: number
          sessions?: number
          total_users?: number
        }
        Update: {
          active_users?: number
          avg_engagement_time?: number
          bounce_rate?: number
          created_at?: string
          engagement_rate?: number
          event_count?: number
          id?: string
          metric_date?: string
          new_users?: number
          organic_traffic?: number
          project_id?: string
          returning_users?: number
          sessions?: number
          total_users?: number
        }
        Relationships: [
          {
            foreignKeyName: "website_metrics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_org_min_role: {
        Args: {
          _min_role: Database["public"]["Enums"]["app_role"]
          _org_id: string
          _user_id: string
        }
        Returns: boolean
      }
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      project_visible: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      project_writable: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "editor" | "viewer"
      integration_provider: "ga4" | "firebase" | "play_console"
      integration_status: "connected" | "disconnected" | "error"
      project_status: "active" | "archived"
      project_type: "website" | "app" | "both"
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
    Enums: {
      app_role: ["admin", "editor", "viewer"],
      integration_provider: ["ga4", "firebase", "play_console"],
      integration_status: ["connected", "disconnected", "error"],
      project_status: ["active", "archived"],
      project_type: ["website", "app", "both"],
    },
  },
} as const
