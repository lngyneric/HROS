import { queryOptions } from "@tanstack/react-query";
import { listOffboardingCases } from "./service";

export const offboardingCasesQuery = queryOptions({
  queryKey: ["offboarding", "cases"],
  queryFn: listOffboardingCases
});
