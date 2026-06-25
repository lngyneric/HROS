import { queryOptions } from "@tanstack/react-query";
import {
  listFinanceOffboardingCases,
  listHrOffboardingCases,
  listHrOnboardingCases,
  listManagerOffboardingCases,
  listManagerOnboardingCases
} from "./service";

export const hrOnboardingWorkitemsQuery = queryOptions({
  queryKey: ["workitems", "hr", "onboarding"],
  queryFn: listHrOnboardingCases
});

export const hrOffboardingWorkitemsQuery = queryOptions({
  queryKey: ["workitems", "hr", "offboarding"],
  queryFn: listHrOffboardingCases
});

export const managerOnboardingWorkitemsQuery = queryOptions({
  queryKey: ["workitems", "manager", "onboarding"],
  queryFn: listManagerOnboardingCases
});

export const managerOffboardingWorkitemsQuery = queryOptions({
  queryKey: ["workitems", "manager", "offboarding"],
  queryFn: listManagerOffboardingCases
});

export const financeOffboardingWorkitemsQuery = queryOptions({
  queryKey: ["workitems", "finance", "offboarding"],
  queryFn: listFinanceOffboardingCases
});
