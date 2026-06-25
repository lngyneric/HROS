import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createOnboardingDraft, submitOnboardingCase } from "./service";
import { onboardingCasesQuery } from "./queries";

export function useCreateOnboardingDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createOnboardingDraft,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: onboardingCasesQuery.queryKey });
    }
  });
}

export function useSubmitOnboardingCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitOnboardingCase,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: onboardingCasesQuery.queryKey });
    }
  });
}
