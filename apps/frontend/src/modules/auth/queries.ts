import { queryOptions } from "@tanstack/react-query";
import { getCurrentUser } from "./service";

export const currentUserQuery = queryOptions({
  queryKey: ["auth", "me"],
  queryFn: getCurrentUser,
  retry: false
});
