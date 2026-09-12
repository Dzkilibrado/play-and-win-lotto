import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { profileSchema } from "./identity";

export const completeProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => profileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: profile, error } = await context.supabase.rpc("complete_profile_onboarding", {
      _display_name: data.name,
      _birth_date: data.birthDate,
      _phone: data.phone,
      _accepted_document_ids: data.acceptedDocumentIds,
    });
    if (error) throw new Error(error.message);
    return profile;
  });
