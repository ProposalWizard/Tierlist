"""Sort each connector tool into Always allow / Needs approval / Never (Harry, 23 Oct 2026; Brain RUL-ALL-0xx).
Look-only tools: Always allow. Anything that changes, sends, spends or publishes: Needs approval.
Anything that wipes data in bulk, takes the site down, or can't be undone: Never."""
import re
READ = {"get","list","search","read","query","fetch","show","find","describe","preview","status","whoami","details",
        "balance","transactions","explore","recommend","metadata","properties","viewer","guide","suggest","download",
        "wait","check","jobs","accounts","trending","options","settings","quote","presets","instructions","answer",
        "attractions","accommodations","styles","palette","type","account","mandatory","readiness","memory"}
PREFIXES = ["notion-calendar-","notion-","slack_","ads_studio_","scene_builder_3d_","ai_influencer_","shorts_studio_",
            "image_","pdf_","video_","asset_","font_","boards_","document_","kv_namespaces_","kv_namespace_","r2_buckets_",
            "r2_bucket_","d1_databases_","d1_database_","hyperdrive_configs_","hyperdrive_config_","workers_","tiktok_",
            "website_","media_","apps_"]
NEVER = {"Supabase":{"pause_project","restore_project","create_project","delete_branch"},
  "Cloudflare Developer Platform":{"r2_bucket_delete","kv_namespace_delete","d1_database_delete","hyperdrive_config_delete"},
  "Notion":{"notion-delete-pages","notion-delete-databases"},
  "Higgsfield":{"delete_project","delete_folder","participate_in_contest","cancel_trial_auto_renewal","unpublish_project"},
  "Adobe":{"boards_delete"}, "Claude Docs":{"delete"}, "Gmail":set(), "Google Drive":set()}
FORCE_ASK = {"confirm_cost","execute_sql","d1_database_query","scene_builder_3d_query_python","scene_builder_3d_run_python","sandbox_exec",
  "website_secrets","website_repo_access","set_active_account","slack_get_file_upload_url","virality_predictor"}
FORCE_READ = {"generate_typescript_types","create_visual_design_express_skill","html_export_readiness_skill","adobe_mandatory_init",
  "acrobat_readonly_proxy","website_db","generate_indd_mapping_prompt","models_explore","get_publishable_keys",
  "accounts_list","search_cloudflare_documentation","migrate_pages_to_workers_guide","guide","read","query","export","search_docs",
  "query_logs","job_display","jobs_wait","pdf_viewer","search_design","font_recommend","suggest_type_palettes"}
def verb(t):
    s=t
    for p in PREFIXES:
        if s.startswith(p): s=s[len(p):]; break
    return re.split(r"[_\-]",s)[0]
def classify(conn,t):
    if t in NEVER.get(conn,()): return "never"
    if t in FORCE_ASK: return "ask"
    if t in FORCE_READ: return "always"
    return "always" if verb(t) in READ else "ask"
WHY = {"never":"wipes data, takes the site down, or can't be undone","ask":"changes, sends, spends or publishes something","always":"only looks"}
