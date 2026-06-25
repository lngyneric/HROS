export type LoginInput = {
  email: string;
  password: string;
};

export type LoginResponse = {
  token: string;
};

export type CurrentUser = {
  id: string;
  role: string;
  dataScope: string;
  employeeId: string | null;
};

export type RoleHomePath = "/self" | "/manager" | "/finance" | "/hr";
