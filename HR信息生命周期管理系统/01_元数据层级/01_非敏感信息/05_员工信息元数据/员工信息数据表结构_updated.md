# 员工信息数据表结构_updated

## 表名

`employee_basic_info`

## 表描述

员工基础信息表，用于存储员工的基础信息，包括个人信息、工作信息和其他相关信息。

## 字段定义

| 字段名 | 数据类型 | 长度 | 是否为空 | 默认值 | 说明 | 业务文档要求 |
|-------|---------|------|----------|--------|------|--------------|
| employee_id | VARCHAR | 50 | 否 | 无 | 员工编号 | ✅ 与业务文档一致 |
| employee_number | VARCHAR | 50 | 否 | 无 | 员工工号 | ✅ 与业务文档一致（长度从20调整为50） |
| name | VARCHAR | 100 | 否 | 无 | 姓名 | ✅ 与业务文档一致 |
| gender | VARCHAR | 10 | 否 | '男' | 性别（男/女） | ✅ 与业务文档一致 |
| email | VARCHAR | 100 | 否 | 无 | 电子邮箱 | ✅ 与业务文档一致 |
| phone | VARCHAR | 20 | 否 | 无 | 联系电话 | ✅ 与业务文档一致 |
| birth_date | DATE | 无 | 否 | '2000-01-01' | 出生日期 | ✅ 与业务文档一致 |
| employee_type | VARCHAR | 50 | 否 | '正式' | 员工类型（正式/实习/兼职） | ✅ 与业务文档一致 |
| company | VARCHAR | 100 | 否 | 'SCH' | 公司（SCH） | ✅ 与业务文档一致（长度从50调整为100） |
| employee_level | VARCHAR | 50 | 否 | '中级' | 员工级别（初级/中级/高级/专家） | ✅ 与业务文档一致 |
| join_date | TIMESTAMP | 无 | 否 | CURRENT_TIMESTAMP | 入职日期（替代原hire_date字段） | ✅ 与业务文档一致 |
| employee_position | VARCHAR | 100 | 否 | '' | 职位 | ✅ 与业务文档一致 |
| employee_department | VARCHAR | 100 | 否 | '' | 部门 | ✅ 与业务文档一致 |
| employee_email | VARCHAR | 100 | 否 | '' | 电子邮箱 | ✅ 与业务文档一致 |
| employee_phone | VARCHAR | 20 | 否 | '' | 联系电话 | ✅ 与业务文档一致 |
| employee_address | VARCHAR | 200 | 否 | '' | 家庭地址 | ✅ 与业务文档一致 |
| status | VARCHAR | 10 | 否 | '在职' | 员工状态（在职/离职/待入职） | ✅ 与业务文档一致 |
| create_time | TIMESTAMP | 无 | 否 | CURRENT_TIMESTAMP | 创建时间 | ✅ 与业务文档一致 |
| update_time | TIMESTAMP | 无 | 否 | CURRENT_TIMESTAMP | 更新时间 | ✅ 与业务文档一致 |

## 字段验证规则

### 性别字段验证

```sql
-- 检查性别字段值是否符合要求
SELECT
    gender,
    COUNT(*) as count
FROM employee_basic_info
WHERE gender NOT IN ('男', '女')
GROUP BY gender;
```

### 员工状态字段验证

```sql
-- 检查员工状态字段值是否符合要求
SELECT
    status,
    COUNT(*) as count
FROM employee_basic_info
WHERE status NOT IN ('在职', '离职', '待入职')
GROUP BY status;
```

### 员工类型字段验证

```sql
-- 检查员工类型字段值是否符合要求
SELECT
    employee_type,
    COUNT(*) as count
FROM employee_basic_info
WHERE employee_type NOT IN ('正式', '实习', '兼职')
GROUP BY employee_type;
```

### 员工级别字段验证

```sql
-- 检查员工级别字段值是否符合要求
SELECT
    employee_level,
    COUNT(*) as count
FROM employee_basic_info
WHERE employee_level NOT IN ('初级', '中级', '高级', '专家')
GROUP BY employee_level;
```

## 索引建议

### 主键索引

```sql
-- 创建主键索引
ALTER TABLE employee_basic_info ADD PRIMARY KEY (employee_id);
```

### 常用查询字段索引

```sql
-- 为常用查询字段创建索引
CREATE INDEX idx_employee_number ON employee_basic_info(employee_number);
CREATE INDEX idx_name ON employee_basic_info(name);
CREATE INDEX idx_email ON employee_basic_info(email);
CREATE INDEX idx_phone ON employee_basic_info(phone);
CREATE INDEX idx_employee_type ON employee_basic_info(employee_type);
CREATE INDEX idx_employee_level ON employee_basic_info(employee_level);
CREATE INDEX idx_status ON employee_basic_info(status);
CREATE INDEX idx_join_date ON employee_basic_info(join_date);
CREATE INDEX idx_employee_position ON employee_basic_info(employee_position);
CREATE INDEX idx_employee_department ON employee_basic_info(employee_department);
```

## 数据示例

```sql
-- 示例数据
INSERT INTO employee_basic_info (
    employee_id, employee_number, name, gender, email, phone, birth_date,
    employee_type, company, employee_level, join_date,
    employee_position, employee_department, employee_email, employee_phone,
    employee_address, status
) VALUES (
    'emp001', 'E2026001', '张三', '男', 'zhangsan@example.com', '13800138001',
    '1990-01-01', '正式', 'SCH', '中级', '2026-03-01',
    '软件工程师', '技术部', 'zhangsan@sch.com', '13800138001',
    '北京市朝阳区', '在职'
), (
    'emp002', 'E2026002', '李四', '女', 'lisi@example.com', '13800138002',
    '1992-05-15', '正式', 'SCH', '中级', '2026-03-01',
    '产品经理', '产品部', 'lisi@sch.com', '13800138002',
    '北京市海淀区', '在职'
);
```

## 查询优化建议

### 查询示例

```sql
-- 查询在职员工
SELECT *
FROM employee_basic_info
WHERE status = '在职';

-- 查询正式员工
SELECT *
FROM employee_basic_info
WHERE employee_type = '正式';

-- 查询中级员工
SELECT *
FROM employee_basic_info
WHERE employee_level = '中级';

-- 查询特定部门员工
SELECT *
FROM employee_basic_info
WHERE employee_department = '技术部';

-- 查询入职日期在2026年的员工
SELECT *
FROM employee_basic_info
WHERE join_date >= '2026-01-01' AND join_date < '2027-01-01';
```

### 查询优化

1. 使用索引字段进行查询
2. 避免在查询条件中使用函数操作索引字段
3. 合理使用LIMIT限制查询结果数量
4. 定期更新表统计信息以提高查询优化器效率

## 数据完整性检查

```sql
-- 检查字段填充情况
SELECT
    COUNT(*) as total_records,
    COUNT(CASE WHEN employee_id IS NOT NULL THEN 1 END) as id_not_null,
    COUNT(CASE WHEN employee_number IS NOT NULL THEN 1 END) as number_not_null,
    COUNT(CASE WHEN name IS NOT NULL THEN 1 END) as name_not_null,
    COUNT(CASE WHEN gender IS NOT NULL THEN 1 END) as gender_not_null,
    COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as email_not_null,
    COUNT(CASE WHEN phone IS NOT NULL THEN 1 END) as phone_not_null,
    COUNT(CASE WHEN employee_type IS NOT NULL THEN 1 END) as type_not_null,
    COUNT(CASE WHEN company IS NOT NULL THEN 1 END) as company_not_null,
    COUNT(CASE WHEN employee_level IS NOT NULL THEN 1 END) as level_not_null,
    COUNT(CASE WHEN join_date IS NOT NULL THEN 1 END) as join_date_not_null,
    COUNT(CASE WHEN status IS NOT NULL THEN 1 END) as status_not_null
FROM employee_basic_info;
```

---

**版本信息**：1.0.0
**更新时间**：2026年3月2日
**状态**：已完成