import { queryOptions } from "@tanstack/react-query";
import { listOnboardingCases } from "./service";

export const onboardingCasesQuery = queryOptions({
  queryKey: ["onboarding", "cases"],
  queryFn: listOnboardingCases
});
