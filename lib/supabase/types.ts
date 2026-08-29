export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      merchants: {
        Row: {
          id: string;
          user_id: string;
          business_name: string;
          business_type: string;
          city: string;
          website_url: string | null;
          phone: string | null;
          description: string | null;
          logo_url: string | null;
          response_tone: "chaleureux" | "premium" | "professionnel" | "convivial";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          business_name: string;
          business_type: string;
          city: string;
          website_url?: string | null;
          phone?: string | null;
          description?: string | null;
          logo_url?: string | null;
          response_tone?: "chaleureux" | "premium" | "professionnel" | "convivial";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          business_name?: string;
          business_type?: string;
          city?: string;
          website_url?: string | null;
          phone?: string | null;
          description?: string | null;
          logo_url?: string | null;
          response_tone?: "chaleureux" | "premium" | "professionnel" | "convivial";
          created_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          merchant_id: string;
          author_name: string;
          rating: number;
          review_text: string;
          content: string | null;
          source: string;
          source_review_id: string | null;
          status: "urgent" | "a-traiter" | "a_traiter" | "ready_to_publish" | "validation_required" | "repondu" | "generated" | "published" | "published_auto" | "published_manual" | "blocked_by_safety" | "ignored";
          sentiment: "positif" | "neutre" | "negatif";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          author_name: string;
          rating: number;
          review_text: string;
          content?: string | null;
          source?: string;
          source_review_id?: string | null;
          status?: "urgent" | "a-traiter" | "a_traiter" | "ready_to_publish" | "validation_required" | "repondu" | "generated" | "published" | "published_auto" | "published_manual" | "blocked_by_safety" | "ignored";
          sentiment: "positif" | "neutre" | "negatif";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          author_name?: string;
          rating?: number;
          review_text?: string;
          content?: string | null;
          source?: string;
          source_review_id?: string | null;
          status?: "urgent" | "a-traiter" | "a_traiter" | "ready_to_publish" | "validation_required" | "repondu" | "generated" | "published" | "published_auto" | "published_manual" | "blocked_by_safety" | "ignored";
          sentiment?: "positif" | "neutre" | "negatif";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          }
        ];
      };
      generated_replies: {
        Row: {
          id: string;
          review_id: string;
          generated_text: string | null;
          reply_text: string;
          status: "generated" | "selected" | "approved" | "validation_required" | "published" | "published_auto" | "published_manual" | "blocked_by_safety" | "superseded";
          is_edited: boolean;
          edited_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          review_id: string;
          generated_text?: string | null;
          reply_text: string;
          status?: "generated" | "selected" | "approved" | "validation_required" | "published" | "published_auto" | "published_manual" | "blocked_by_safety" | "superseded";
          is_edited?: boolean;
          edited_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          review_id?: string;
          generated_text?: string | null;
          reply_text?: string;
          status?: "generated" | "selected" | "approved" | "validation_required" | "published" | "published_auto" | "published_manual" | "blocked_by_safety" | "superseded";
          is_edited?: boolean;
          edited_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "generated_replies_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          }
        ];
      };
      review_insights: {
        Row: {
          id: string;
          merchant_id: string;
          analysis_json: Json;
          created_at: string;
          latest_review_updated_at: string | null;
          reviews_count: number | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          analysis_json?: Json;
          created_at?: string;
          latest_review_updated_at?: string | null;
          reviews_count?: number | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          analysis_json?: Json;
          created_at?: string;
          latest_review_updated_at?: string | null;
          reviews_count?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_insights_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          }
        ];
      };
      social_post_ideas: {
        Row: {
          id: string;
          merchant_id: string;
          platform: "instagram" | "facebook";
          title: string;
          angle: string;
          source_type: string;
          source_reference: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          platform: "instagram" | "facebook";
          title: string;
          angle: string;
          source_type?: string;
          source_reference?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          platform?: "instagram" | "facebook";
          title?: string;
          angle?: string;
          source_type?: string;
          source_reference?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "social_post_ideas_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          }
        ];
      };
      social_posts: {
        Row: {
          id: string;
          merchant_id: string;
          platform: "instagram" | "facebook";
          title: string;
          caption: string;
          cta: string | null;
          hashtags: string[];
          visual_url: string | null;
          source: "manual" | "automation";
          status: "draft" | "editing" | "ready" | "exported" | "saved" | "scheduled" | "published";
          created_at: string;
          updated_at: string;
          last_saved_at: string | null;
          scheduled_at: string | null;
          published_at: string | null;
          error_message: string | null;
          instagram_media_id: string | null;
          template_id: string | null;
          visual_html: string | null;
          builder_state: Json | null;
          visual_text: string | null;
          image_url: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          accent_color: string | null;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          platform: "instagram" | "facebook";
          title: string;
          caption: string;
          cta?: string | null;
          hashtags?: string[];
          visual_url?: string | null;
          source?: "manual" | "automation";
          status?: "draft" | "editing" | "ready" | "exported" | "saved" | "scheduled" | "published";
          created_at?: string;
          updated_at?: string;
          last_saved_at?: string | null;
          scheduled_at?: string | null;
          published_at?: string | null;
          error_message?: string | null;
          instagram_media_id?: string | null;
          template_id?: string | null;
          visual_html?: string | null;
          builder_state?: Json | null;
          visual_text?: string | null;
          image_url?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          accent_color?: string | null;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          platform?: "instagram" | "facebook";
          title?: string;
          caption?: string;
          cta?: string | null;
          hashtags?: string[];
          visual_url?: string | null;
          source?: "manual" | "automation";
          status?: "draft" | "editing" | "ready" | "exported" | "saved" | "scheduled" | "published";
          created_at?: string;
          updated_at?: string;
          last_saved_at?: string | null;
          scheduled_at?: string | null;
          published_at?: string | null;
          error_message?: string | null;
          instagram_media_id?: string | null;
          template_id?: string | null;
          visual_html?: string | null;
          builder_state?: Json | null;
          visual_text?: string | null;
          image_url?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          accent_color?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "social_posts_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          }
        ];
      };
      design_templates: {
        Row: {
          id: string;
          name: string;
          format: "instagram_square" | "story" | "facebook_post";
          category: string;
          tags: string[];
          html_content: string;
          created_at: string;
          uploaded_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          format?: "instagram_square" | "story" | "facebook_post";
          category?: string;
          tags?: string[];
          html_content: string;
          created_at?: string;
          uploaded_by?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          format?: "instagram_square" | "story" | "facebook_post";
          category?: string;
          tags?: string[];
          html_content?: string;
          created_at?: string;
          uploaded_by?: string | null;
        };
        Relationships: [];
      };
      media_assets: {
        Row: {
          id: string;
          url: string;
          title: string;
          tags: string[];
          category: string;
          created_at: string;
          uploaded_by: string | null;
        };
        Insert: {
          id?: string;
          url: string;
          title: string;
          tags?: string[];
          category?: string;
          created_at?: string;
          uploaded_by?: string | null;
        };
        Update: {
          id?: string;
          url?: string;
          title?: string;
          tags?: string[];
          category?: string;
          created_at?: string;
          uploaded_by?: string | null;
        };
        Relationships: [];
      };
      merchant_brand_settings: {
        Row: {
          id: string;
          merchant_id: string;
          primary_color: string;
          secondary_color: string;
          accent_color: string;
          social_font_family: string;
          social_template_style: "editorial" | "artisan" | "impact";
          show_logo_on_social_posts: boolean;
          social_logo_position: "top_left" | "top_right" | "bottom_left" | "bottom_right";
          visual_style: "premium" | "chaleureux" | "moderne" | "artisanal" | "minimaliste" | "dynamique";
          tone: "simple" | "professionnel" | "convivial" | "haut_de_gamme";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          primary_color?: string;
          secondary_color?: string;
          accent_color?: string;
          social_font_family?: string;
          social_template_style?: "editorial" | "artisan" | "impact";
          show_logo_on_social_posts?: boolean;
          social_logo_position?: "top_left" | "top_right" | "bottom_left" | "bottom_right";
          visual_style?: "premium" | "chaleureux" | "moderne" | "artisanal" | "minimaliste" | "dynamique";
          tone?: "simple" | "professionnel" | "convivial" | "haut_de_gamme";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          primary_color?: string;
          secondary_color?: string;
          accent_color?: string;
          social_font_family?: string;
          social_template_style?: "editorial" | "artisan" | "impact";
          show_logo_on_social_posts?: boolean;
          social_logo_position?: "top_left" | "top_right" | "bottom_left" | "bottom_right";
          visual_style?: "premium" | "chaleureux" | "moderne" | "artisanal" | "minimaliste" | "dynamique";
          tone?: "simple" | "professionnel" | "convivial" | "haut_de_gamme";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_brand_settings_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: true;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          }
        ];
      };
      merchant_automation_settings: {
        Row: {
          id: string;
          merchant_id: string;
          reviews_auto_reply_enabled: boolean;
          review_automation_mode: "disabled" | "semi_automatic" | "automatic_guarded";
          reviews_five_star_action: "disabled" | "validation" | "automatic";
          reviews_four_star_action: "disabled" | "validation" | "automatic";
          reviews_three_star_action: "disabled" | "validation" | "automatic";
          reviews_one_two_star_action: "disabled" | "validation" | "automatic";
          always_validate_negative_reviews: boolean;
          block_sensitive_reviews: boolean;
          sensitive_keywords: string[];
          social_auto_publish_enabled: boolean;
          social_auto_publish_live: boolean;
          social_posts_per_week: number;
          social_posts_per_cycle: number;
          social_cycle_weeks: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          reviews_auto_reply_enabled?: boolean;
          review_automation_mode?: "disabled" | "semi_automatic" | "automatic_guarded";
          reviews_five_star_action?: "disabled" | "validation" | "automatic";
          reviews_four_star_action?: "disabled" | "validation" | "automatic";
          reviews_three_star_action?: "disabled" | "validation" | "automatic";
          reviews_one_two_star_action?: "disabled" | "validation" | "automatic";
          always_validate_negative_reviews?: boolean;
          block_sensitive_reviews?: boolean;
          sensitive_keywords?: string[];
          social_auto_publish_enabled?: boolean;
          social_auto_publish_live?: boolean;
          social_posts_per_week?: number;
          social_posts_per_cycle?: number;
          social_cycle_weeks?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          reviews_auto_reply_enabled?: boolean;
          review_automation_mode?: "disabled" | "semi_automatic" | "automatic_guarded";
          reviews_five_star_action?: "disabled" | "validation" | "automatic";
          reviews_four_star_action?: "disabled" | "validation" | "automatic";
          reviews_three_star_action?: "disabled" | "validation" | "automatic";
          reviews_one_two_star_action?: "disabled" | "validation" | "automatic";
          always_validate_negative_reviews?: boolean;
          block_sensitive_reviews?: boolean;
          sensitive_keywords?: string[];
          social_auto_publish_enabled?: boolean;
          social_auto_publish_live?: boolean;
          social_posts_per_week?: number;
          social_posts_per_cycle?: number;
          social_cycle_weeks?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_automation_settings_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: true;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          }
        ];
      };
      customers: {
        Row: {
          id: string;
          merchant_id: string;
          first_name: string;
          last_name: string;
          phone: string;
          email: string | null;
          gender_guess: string | null;
          opt_in_sms: boolean;
          sms_unsubscribed: boolean;
          favorite_products: string[];
          last_purchase_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          first_name: string;
          last_name?: string;
          phone: string;
          email?: string | null;
          gender_guess?: string | null;
          opt_in_sms?: boolean;
          sms_unsubscribed?: boolean;
          favorite_products?: string[];
          last_purchase_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          first_name?: string;
          last_name?: string;
          phone?: string;
          email?: string | null;
          gender_guess?: string | null;
          opt_in_sms?: boolean;
          sms_unsubscribed?: boolean;
          favorite_products?: string[];
          last_purchase_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customers_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          }
        ];
      };
      customer_events: {
        Row: {
          id: string;
          customer_id: string;
          merchant_id: string;
          event_type: string;
          product_name: string | null;
          amount_cents: number | null;
          happened_at: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          merchant_id: string;
          event_type?: string;
          product_name?: string | null;
          amount_cents?: number | null;
          happened_at?: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          merchant_id?: string;
          event_type?: string;
          product_name?: string | null;
          amount_cents?: number | null;
          happened_at?: string;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_events_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_events_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          }
        ];
      };
      sms_campaigns: {
        Row: {
          id: string;
          merchant_id: string;
          title: string;
          objective: string;
          audience_label: string;
          audience_rule: Json;
          tone: "chaleureux" | "premium" | "drôle" | "direct" | "élégant" | "familial";
          message_template: string | null;
          status: "draft" | "scheduled" | "sent";
          test_customer_id: string | null;
          scheduled_at: string | null;
          sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          title: string;
          objective: string;
          audience_label: string;
          audience_rule?: Json;
          tone?: "chaleureux" | "premium" | "drôle" | "direct" | "élégant" | "familial";
          message_template?: string | null;
          status?: "draft" | "scheduled" | "sent";
          test_customer_id?: string | null;
          scheduled_at?: string | null;
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          title?: string;
          objective?: string;
          audience_label?: string;
          audience_rule?: Json;
          tone?: "chaleureux" | "premium" | "drôle" | "direct" | "élégant" | "familial";
          message_template?: string | null;
          status?: "draft" | "scheduled" | "sent";
          test_customer_id?: string | null;
          scheduled_at?: string | null;
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sms_campaigns_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          }
        ];
      };
      sms_messages: {
        Row: {
          id: string;
          merchant_id: string;
          campaign_id: string | null;
          customer_id: string | null;
          phone: string;
          message_text: string;
          direction: "outbound";
          status: "draft" | "test_sent" | "queued" | "sent" | "failed";
          sms_parts: number;
          error_message: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          campaign_id?: string | null;
          customer_id?: string | null;
          phone: string;
          message_text: string;
          direction?: "outbound";
          status?: "draft" | "test_sent" | "queued" | "sent" | "failed";
          sms_parts?: number;
          error_message?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          campaign_id?: string | null;
          customer_id?: string | null;
          phone?: string;
          message_text?: string;
          direction?: "outbound";
          status?: "draft" | "test_sent" | "queued" | "sent" | "failed";
          sms_parts?: number;
          error_message?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sms_messages_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "sms_campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sms_messages_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sms_messages_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          }
        ];
      };
      sms_templates: {
        Row: {
          id: string;
          merchant_id: string | null;
          name: string;
          objective: string;
          tone: string;
          template_text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id?: string | null;
          name: string;
          objective: string;
          tone: string;
          template_text: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string | null;
          name?: string;
          objective?: string;
          tone?: string;
          template_text?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sms_templates_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          }
        ];
      };
      rcu_records: {
        Row: {
          id: string;
          merchant_id: string;
          record_type: string;
          program_id: string;
          customer_key: string;
          public_token: string;
          visit_day: string;
          payload: Json;
          occurred_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          record_type?: string;
          program_id: string;
          customer_key: string;
          public_token: string;
          visit_day: string;
          payload: Json;
          occurred_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          record_type?: string;
          program_id?: string;
          customer_key?: string;
          public_token?: string;
          visit_day?: string;
          payload?: Json;
          occurred_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rcu_records_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          }
        ];
      };
      rcu_forms: {
        Row: {
          id: string;
          merchant_id: string;
          slug: string;
          form_type: string;
          title: string;
          incentive_text: string;
          consent_label: string;
          cta_label: string | null;
          target_url: string | null;
          discount_label: string | null;
          discount_value: number | null;
          promo_prefix: string | null;
          is_active: boolean;
          success_message: string | null;
          poster_headline: string | null;
          poster_body: string | null;
          poster_theme: string | null;
          game_config: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          slug: string;
          form_type?: string;
          title: string;
          incentive_text: string;
          consent_label: string;
          cta_label?: string | null;
          target_url?: string | null;
          discount_label?: string | null;
          discount_value?: number | null;
          promo_prefix?: string | null;
          is_active?: boolean;
          success_message?: string | null;
          poster_headline?: string | null;
          poster_body?: string | null;
          poster_theme?: string | null;
          game_config?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          slug?: string;
          form_type?: string;
          title?: string;
          incentive_text?: string;
          consent_label?: string;
          cta_label?: string | null;
          target_url?: string | null;
          discount_label?: string | null;
          discount_value?: number | null;
          promo_prefix?: string | null;
          is_active?: boolean;
          success_message?: string | null;
          poster_headline?: string | null;
          poster_body?: string | null;
          poster_theme?: string | null;
          game_config?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rcu_forms_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          }
        ];
      };
      sms_leads_forms: {
        Row: {
          id: string;
          form_id: string;
          merchant_id: string;
          first_name: string;
          last_name: string;
          phone: string;
          email: string | null;
          favorite_products: string | null;
          consent_sms: boolean;
          promo_code: string | null;
          promo_label: string | null;
          promo_value: number | null;
          redeemed_at: string | null;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          form_id: string;
          merchant_id: string;
          first_name: string;
          last_name?: string;
          phone: string;
          email?: string | null;
          favorite_products?: string | null;
          consent_sms?: boolean;
          promo_code?: string | null;
          promo_label?: string | null;
          promo_value?: number | null;
          redeemed_at?: string | null;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          form_id?: string;
          merchant_id?: string;
          first_name?: string;
          last_name?: string;
          phone?: string;
          email?: string | null;
          favorite_products?: string | null;
          consent_sms?: boolean;
          promo_code?: string | null;
          promo_label?: string | null;
          promo_value?: number | null;
          redeemed_at?: string | null;
          submitted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sms_leads_forms_form_id_fkey";
            columns: ["form_id"];
            isOneToOne: false;
            referencedRelation: "rcu_forms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sms_leads_forms_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          }
        ];
      };
      generated_visuals: {
        Row: {
          id: string;
          merchant_id: string;
          social_post_id: string | null;
          source_image_url: string | null;
          generated_image_url: string;
          style: string;
          prompt: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          social_post_id?: string | null;
          source_image_url?: string | null;
          generated_image_url: string;
          style: string;
          prompt?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          social_post_id?: string | null;
          source_image_url?: string | null;
          generated_image_url?: string;
          style?: string;
          prompt?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "generated_visuals_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "generated_visuals_social_post_id_fkey";
            columns: ["social_post_id"];
            isOneToOne: false;
            referencedRelation: "social_posts";
            referencedColumns: ["id"];
          }
        ];
      };
      merchant_media_assets: {
        Row: {
          id: string;
          merchant_id: string;
          url: string;
          alt_text: string | null;
          category: string | null;
          source: "upload" | "website_scrape" | "generated_ai";
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          url: string;
          alt_text?: string | null;
          category?: string | null;
          source?: "upload" | "website_scrape" | "generated_ai";
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          url?: string;
          alt_text?: string | null;
          category?: string | null;
          source?: "upload" | "website_scrape" | "generated_ai";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "merchant_media_assets_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          }
        ];
      };
      google_connections: {
        Row: {
          id: string;
          merchant_id: string;
          google_account_email: string | null;
          google_location_name: string | null;
          google_location_id: string | null;
          access_token_encrypted: string | null;
          refresh_token_encrypted: string | null;
          granted_scopes: string[];
          connected_at: string;
          last_sync_at: string | null;
          last_error: string | null;
          status: "connected" | "disconnected" | "error";
        };
        Insert: {
          id?: string;
          merchant_id: string;
          google_account_email?: string | null;
          google_location_name?: string | null;
          google_location_id?: string | null;
          access_token_encrypted?: string | null;
          refresh_token_encrypted?: string | null;
          granted_scopes?: string[];
          connected_at?: string;
          last_sync_at?: string | null;
          last_error?: string | null;
          status?: "connected" | "disconnected" | "error";
        };
        Update: {
          id?: string;
          merchant_id?: string;
          google_account_email?: string | null;
          google_location_name?: string | null;
          google_location_id?: string | null;
          access_token_encrypted?: string | null;
          refresh_token_encrypted?: string | null;
          granted_scopes?: string[];
          connected_at?: string;
          last_sync_at?: string | null;
          last_error?: string | null;
          status?: "connected" | "disconnected" | "error";
        };
        Relationships: [
          {
            foreignKeyName: "google_connections_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          }
        ];
      };
      instagram_connections: {
        Row: {
          id: string;
          merchant_id: string;
          instagram_account_id: string | null;
          instagram_username: string | null;
          access_token_encrypted: string | null;
          refresh_token_encrypted: string | null;
          connected_at: string;
          last_sync_at: string | null;
          last_error: string | null;
          status: "connected" | "disconnected" | "error" | "pending_configuration";
        };
        Insert: {
          id?: string;
          merchant_id: string;
          instagram_account_id?: string | null;
          instagram_username?: string | null;
          access_token_encrypted?: string | null;
          refresh_token_encrypted?: string | null;
          connected_at?: string;
          last_sync_at?: string | null;
          last_error?: string | null;
          status?: "connected" | "disconnected" | "error" | "pending_configuration";
        };
        Update: {
          id?: string;
          merchant_id?: string;
          instagram_account_id?: string | null;
          instagram_username?: string | null;
          access_token_encrypted?: string | null;
          refresh_token_encrypted?: string | null;
          connected_at?: string;
          last_sync_at?: string | null;
          last_error?: string | null;
          status?: "connected" | "disconnected" | "error" | "pending_configuration";
        };
        Relationships: [
          {
            foreignKeyName: "instagram_connections_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          }
        ];
      };
      gmail_connections: {
        Row: {
          id: string;
          merchant_id: string;
          google_account_id: string | null;
          gmail_address: string | null;
          access_token_encrypted: string | null;
          refresh_token_encrypted: string | null;
          granted_scopes: string[];
          token_expires_at: string | null;
          connected_at: string;
          last_checked_at: string | null;
          last_error: string | null;
          status: "connected" | "disconnected" | "error";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          google_account_id?: string | null;
          gmail_address?: string | null;
          access_token_encrypted?: string | null;
          refresh_token_encrypted?: string | null;
          granted_scopes?: string[];
          token_expires_at?: string | null;
          connected_at?: string;
          last_checked_at?: string | null;
          last_error?: string | null;
          status?: "connected" | "disconnected" | "error";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          google_account_id?: string | null;
          gmail_address?: string | null;
          access_token_encrypted?: string | null;
          refresh_token_encrypted?: string | null;
          granted_scopes?: string[];
          token_expires_at?: string | null;
          connected_at?: string;
          last_checked_at?: string | null;
          last_error?: string | null;
          status?: "connected" | "disconnected" | "error";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gmail_connections_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          }
        ];
      };
      hans_recommendations: {
        Row: {
          id: string;
          merchant_id: string;
          title: string;
          description: string;
          status: "todo" | "done";
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          title: string;
          description: string;
          status?: "todo" | "done";
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          title?: string;
          description?: string;
          status?: "todo" | "done";
          created_at?: string;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "hans_recommendations_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          }
        ];
      };
      notifications: {
        Row: {
          id: string;
          merchant_id: string;
          title: string;
          body: string;
          type: "new_review" | "urgent_review" | "hans_reply_generated" | "reply_validated" | "report_generated" | "hans_recommendation_created" | "hans_task_done";
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          merchant_id: string;
          title: string;
          body: string;
          type: "new_review" | "urgent_review" | "hans_reply_generated" | "reply_validated" | "report_generated" | "hans_recommendation_created" | "hans_task_done";
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          merchant_id?: string;
          title?: string;
          body?: string;
          type?: "new_review" | "urgent_review" | "hans_reply_generated" | "reply_validated" | "report_generated" | "hans_recommendation_created" | "hans_task_done";
          read?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_merchant_id_fkey";
            columns: ["merchant_id"];
            isOneToOne: false;
            referencedRelation: "merchants";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type MerchantRow = Database["public"]["Tables"]["merchants"]["Row"];
export type ReviewRow = Database["public"]["Tables"]["reviews"]["Row"];
export type GeneratedReplyRow = Database["public"]["Tables"]["generated_replies"]["Row"];
export type ReviewInsightRow = Database["public"]["Tables"]["review_insights"]["Row"];
export type SocialPostIdeaRow = Database["public"]["Tables"]["social_post_ideas"]["Row"];
export type SocialPostRow = Database["public"]["Tables"]["social_posts"]["Row"];
export type MerchantMediaAssetRow = Database["public"]["Tables"]["merchant_media_assets"]["Row"];
export type DesignTemplateRow = Database["public"]["Tables"]["design_templates"]["Row"];
export type MediaAssetRow = Database["public"]["Tables"]["media_assets"]["Row"];
export type MerchantBrandSettingsRow = Database["public"]["Tables"]["merchant_brand_settings"]["Row"];
export type MerchantAutomationSettingsRow = Database["public"]["Tables"]["merchant_automation_settings"]["Row"];
export type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
export type CustomerEventRow = Database["public"]["Tables"]["customer_events"]["Row"];
export type SmsCampaignRow = Database["public"]["Tables"]["sms_campaigns"]["Row"];
export type SmsMessageRow = Database["public"]["Tables"]["sms_messages"]["Row"];
export type SmsTemplateRow = Database["public"]["Tables"]["sms_templates"]["Row"];
export type RcuFormRow = Database["public"]["Tables"]["rcu_forms"]["Row"];
export type RcuRecordRow = Database["public"]["Tables"]["rcu_records"]["Row"];
export type SmsLeadFormRow = Database["public"]["Tables"]["sms_leads_forms"]["Row"];
export type GeneratedVisualRow = Database["public"]["Tables"]["generated_visuals"]["Row"];
export type GoogleConnectionRow = Database["public"]["Tables"]["google_connections"]["Row"];
export type InstagramConnectionRow = Database["public"]["Tables"]["instagram_connections"]["Row"];
export type GmailConnectionRow = Database["public"]["Tables"]["gmail_connections"]["Row"];
export type HansRecommendationRow = Database["public"]["Tables"]["hans_recommendations"]["Row"];
export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
