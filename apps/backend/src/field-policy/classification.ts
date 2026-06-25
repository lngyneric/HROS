export type FieldClassification = "PUBLIC" | "PERSONAL" | "SENSITIVE" | "HIGHLY_SENSITIVE";

export const EmployeeFieldPolicy: Record<string, FieldClassification> = {
  id: "PUBLIC",
  employeeNo: "PERSONAL",
  name: "PERSONAL",
  status: "PUBLIC"
};

export const EmployeeSensitiveFieldPolicy: Record<string, FieldClassification> = {
  employeeId: "PUBLIC",
  idNumber: "HIGHLY_SENSITIVE",
  phone: "SENSITIVE",
  address: "SENSITIVE",
  bankAccount: "HIGHLY_SENSITIVE"
};

