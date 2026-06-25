import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createOffboardingDraft, submitOffboardingCase } from "./service";
import { offboardingCasesQuery } from "./queries";

export function useCreateOffboardingDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createOffboardingDraft,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: offboardingCasesQuery.queryKey });
    }
  });
}

export function useSubmitOffboardingCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitOffboardingCase,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: offboardingCasesQuery.queryKey });
    }
  });
}
