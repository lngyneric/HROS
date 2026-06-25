# 04. 代码与数据处理流水线

## 4.1 概览

当前仓库中唯一的可执行代码位于：

- [05_入离职管理/data_cleaning_and_archive.js](file:///Users/cherrych/Documents/trae_projects/HROS/HR信息生命周期管理系统/05_入离职管理/data_cleaning_and_archive.js)

这是一个独立的 Node.js 脚本，用于对“在职/离职员工信息”进行清洗、归档与统计，并生成一系列 JSON 输出文件和统计报告。

数据处理过程可以抽象为以下流水线：

1. 读取原始 JSON 数据（在职 + 离职）。
2. 对员工记录进行清洗和必填字段校验。
3. 生成离职员工归档文件及归档索引。
4. 生成清洗后的在职员工数据文件。
5. 生成数据清洗报告 JSON。
6. 基于在职员工生成统计信息 JSON。

## 4.2 依赖与执行环境

脚本开头：

```js
const fs = require('fs');
const path = require('path');
```

- 仅依赖 Node.js 内置模块 `fs` 和 `path`，无第三方依赖。
- 脚本中使用了硬编码的 Windows 目录：

```js
const OUTPUT_DIR = "C:\\ShareHub\\HR系统恢复验证\\HR信息生命周期管理系统\\05_入离职管理";
const ARCHIVE_DIR = path.join(OUTPUT_DIR, "03_离职办理阶段", "非敏感信息");
const ACTIVE_DIR = path.join(OUTPUT_DIR, "02_在职期间管理", "非敏感信息");
const DATA_SOURCE_ACTIVE = "C:\\ShareHub\\HR系统恢复验证\\HR信息生命周期管理系统\\05_入离职管理\\02_在职期间管理\\非敏感信息";
const DATA_SOURCE_RESIGNED = "C:\\ShareHub\\HR系统恢复验证\\HR信息生命周期管理系统\\05_入离职管理\\03_离职办理阶段\\非敏感信息";
```

在其他环境（如当前仓库路径）执行时，需要将这些路径修改为本机实际路径或相对路径。

## 4.3 目录与数据源

脚本默认假定的数据目录对应于仓库中的以下位置：

- 数据源目录：
  - 在职员工数据源：
    - [05_入离职管理/02_在职期间管理/非敏感信息/在职员工信息.json](file:///Users/cherrych/Documents/trae_projects/HROS/HR信息生命周期管理系统/05_入离职管理/02_在职期间管理/非敏感信息/在职员工信息.json)
  - 离职员工数据源：
    - [05_入离职管理/03_离职办理阶段/非敏感信息/离职员工信息.json](file:///Users/cherrych/Documents/trae_projects/HROS/HR信息生命周期管理系统/05_入离职管理/03_离职办理阶段/非敏感信息/离职员工信息.json)
- 输出目录：
  - 在职员工相关输出：`02_在职期间管理/非敏感信息/`
  - 离职员工归档相关输出：`03_离职办理阶段/非敏感信息/`
  - 汇总报告：位于 `05_入离职管理/` 根目录。

## 4.4 关键函数与职责

### 4.4.1 目录与文件操作

```js
function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
```

- 确保归档目录和在职数据目录存在。
- 在脚本开始阶段调用，用于创建输出目录树。

```js
function readJsonFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        }
        return null;
    } catch (error) {
        console.error(`× 读取文件失败: ${filePath}`, error.message);
        return null;
    }
}
```

- 读取 JSON 文件，带异常捕获。
- 若文件不存在或解析失败，则返回 null，并打印错误信息。

```js
function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`× 写入文件失败: ${filePath}`, error.message);
        return false;
    }
}
```

- 将对象写入 JSON 文件（带缩进），同样带异常捕获。

### 4.4.2 数据清洗函数

```js
function cleanEmployeeData(employee) {
    const cleaned = { ...employee };

    // 清理字符串字段
    Object.keys(cleaned).forEach(key => {
        if (typeof cleaned[key] === 'string') {
            cleaned[key] = cleaned[key].trim();
        }
    });

    // 确保必填字段存在
    const requiredFields = ['雇员编号', '姓名', '部门'];
    const missingFields = requiredFields.filter(field => !cleaned[field]);

    if (missingFields.length > 0) {
        console.warn(`  警告: 员工 ${cleaned['姓名'] || '未知'} 缺少字段: ${missingFields.join(', ')}`);
    }

    // 标准化部门名称
    if (cleaned['部门']) {
        cleaned['部门'] = cleaned['部门'].replace(/\s+/g, '');
    }

    // 标准化职位名称
    if (cleaned['职位']) {
        cleaned['职位'] = cleaned['职位'].replace(/\s+/g, '');
    }

    return cleaned;
}
```

职责：

- 对所有字符串字段执行 `trim()`，去掉前后空白。
- 校验必填字段 `雇员编号`、`姓名`、`部门` 是否存在，并对缺失字段打印警告。
- 将部门和职位字段中的所有空白字符移除（例如“ BD 事业 开发 部 ”→“BD事业开发部”），保证一致性。

调用方式：

- 在职员工清洗：

  ```js
  const cleanedActiveEmployees = activeEmployees.slice(1).map(cleanEmployeeData);
  ```

  - `slice(1)` 表示跳过第一行，假定第一行是标题。

- 离职员工清洗：

  ```js
  const cleanedResignedEmployees = resignedEmployees.slice(1).map(cleanEmployeeData);
  ```

### 4.4.3 数据完整性验证

```js
function validateDataIntegrity(employees, type) {
    let validCount = 0;
    let invalidCount = 0;
    const issues = [];

    employees.forEach((emp, index) => {
        const hasRequiredFields = emp['雇员编号'] && emp['姓名'] && emp['部门'];

        if (hasRequiredFields) {
            validCount++;
        } else {
            invalidCount++;
            issues.push({
                index: index,
                name: emp['姓名'] || '未知',
                missingFields: !emp['雇员编号'] ? '雇员编号' : (!emp['姓名'] ? '姓名' : '部门')
            });
        }
    });

    return { validCount, invalidCount, issues };
}
```

- 对清洗后的数据进行快速完整性校验：
  - 统计有效记录与无效记录数量。
  - 收集缺少必填字段的记录列表，便于后续人工排查。
- 对在职和离职员工分别调用，用于在控制台打印简要统计信息。

## 4.5 处理步骤与数据流

### 4.5.1 步骤 1：读取原始员工数据

- 输入：
  - `在职员工信息.json`
  - `离职员工信息.json`
- 操作：
  - 使用 `readJsonFile` 读取两个文件。
  - 若任一读取失败，则脚本退出。

### 4.5.2 步骤 2：数据清洗

- 处理逻辑：
  - 对在职和离职员工列表（去掉第一行标题）分别调用 `cleanEmployeeData`。
  - 生成 `cleanedActiveEmployees` 和 `cleanedResignedEmployees`。
- 输出：
  - 清洗后的员工数组（尚未写回文件）。

### 4.5.3 步骤 3：数据验证和统计

- 处理逻辑：
  - 调用 `validateDataIntegrity(cleanedActiveEmployees, "在职员工")`。
  - 调用 `validateDataIntegrity(cleanedResignedEmployees, "离职员工")`。
- 输出：
  - 在控制台打印有效/无效记录统计和部分问题记录详情。

### 4.5.4 步骤 4：归档离职员工数据

- 处理逻辑：
  - 构造带时间戳的文件名：

    ```js
    const archiveTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const archiveFile = path.join(ARCHIVE_DIR, `离职员工归档_${archiveTimestamp}.json`);
    ```

  - 归档内容结构：

    ```js
    const archivedResignedEmployees = {
      archiveInfo: {
        archivedAt: new Date().toISOString(),
        totalRecords: cleanedResignedEmployees.length,
        archiveReason: "离职员工数据归档",
        version: "1.0"
      },
      employees: cleanedResignedEmployees
    };
    ```

  - 写入归档 JSON 文件。
- 归档索引：

  ```js
  const archiveIndex = {
      lastUpdated: new Date().toISOString(),
      archives: [{
          filename: `离职员工归档_${archiveTimestamp}.json`,
          archivedAt: new Date().toISOString(),
          recordCount: cleanedResignedEmployees.length,
          status: "archived"
      }],
      statistics: {
          totalArchivedRecords: cleanedResignedEmployees.length,
          archiveCount: 1
      }
  };
  ```

- 写入 `归档索引.json`，用于快速了解归档历史和数量。

### 4.5.5 步骤 5：更新在职员工数据

- 输出结构：

```js
const activeEmployeesData = {
    lastUpdated: new Date().toISOString(),
    totalRecords: cleanedActiveEmployees.length,
    dataSource: "HR系统在职员工数据",
    version: "1.0",
    employees: cleanedActiveEmployees
};
```

- 写入：
  - [02_在职期间管理/非敏感信息/在职员工信息_清洗后.json](file:///Users/cherrych/Documents/trae_projects/HROS/HR信息生命周期管理系统/05_入离职管理/02_在职期间管理/非敏感信息/在职员工信息_清洗后.json)

### 4.5.6 步骤 6：生成数据清洗报告

- 报告结构（摘要）：

```js
const cleaningReport = {
    reportTime: new Date().toISOString(),
    summary: {
        originalActiveEmployees: activeEmployees.length,
        originalResignedEmployees: resignedEmployees.length,
        cleanedActiveEmployees: cleanedActiveEmployees.length,
        cleanedResignedEmployees: cleanedResignedEmployees.length,
        archivedResignedEmployees: cleanedResignedEmployees.length
    },
    dataQuality: { ... },
    archiveInfo: {
        archiveFile: archiveFile,
        archiveIndex: archiveIndexFile,
        archiveTimestamp: archiveTimestamp
    },
    outputFiles: {
        activeEmployees: activeEmployeesFile_new,
        archiveIndex: archiveIndexFile
    }
};
```

- 写入：
  - `05_入离职管理/数据清洗和归档报告.json`

该文件为后续审计和运维排查提供了非常直观的依据。

### 4.5.7 步骤 7：更新在职员工统计信息

- 统计内容：
  - 部门分布：`departmentDistribution`
  - 职位分布：`positionDistribution`
  - 地点分布：`locationDistribution`
  - 性别分布：`genderDistribution`

- 输出结构：

```js
const activeStats = {
    lastUpdated: new Date().toISOString(),
    totalEmployees: cleanedActiveEmployees.length,
    departmentDistribution: { ... },
    positionDistribution: { ... },
    locationDistribution: { ... },
    genderDistribution: { male: 0, female: 0, unknown: 0 }
};
```

- 写入：
  - [02_在职期间管理/非敏感信息/在职员工统计信息.json](file:///Users/cherrych/Documents/trae_projects/HROS/HR信息生命周期管理系统/05_入离职管理/02_在职期间管理/非敏感信息/在职员工统计信息.json)

## 4.6 运行说明与注意事项

### 4.6.1 环境准备

- 安装 Node.js（建议 16+）。
- 将脚本中的路径常量修改为本机路径：
  - 推荐做法是在仓库根目录使用相对路径，例如：

    ```js
    const baseDir = path.join(__dirname);
    const OUTPUT_DIR = baseDir;
    const ARCHIVE_DIR = path.join(OUTPUT_DIR, "03_离职办理阶段", "非敏感信息");
    const ACTIVE_DIR = path.join(OUTPUT_DIR, "02_在职期间管理", "非敏感信息");
    const DATA_SOURCE_ACTIVE = ACTIVE_DIR;
    const DATA_SOURCE_RESIGNED = path.join(OUTPUT_DIR, "03_离职办理阶段", "非敏感信息");
    ```

### 4.6.2 运行命令

在脚本所在目录（`05_入离职管理`）执行：

```bash
node data_cleaning_and_archive.js
```

执行成功后，应生成或更新以下文件：

- `02_在职期间管理/非敏感信息/在职员工信息_清洗后.json`
- `02_在职期间管理/非敏感信息/在职员工统计信息.json`
- `03_离职办理阶段/非敏感信息/离职员工归档_*.json`
- `03_离职办理阶段/非敏感信息/归档索引.json`
- `05_入离职管理/数据清洗和归档报告.json`

### 4.6.3 与元数据/分析层的衔接

- 清洗脚本使用的字段（部门、职位、性别、工作地点等）应与“员工信息元数据”中的字段定义保持一致。
- 生成的统计信息可以用作分析数据层级的输入，或直接导入 BI 工具进行可视化。

## 4.7 对后续脚本与服务化的参考价值

该脚本虽为单文件实现，但体现了若干值得在服务化阶段继承的设计思路：

- 清晰的步骤划分：读取→清洗→验证→归档→报告→统计。
- 对输入/输出文件的统一管理（通过目录常量和集中写入函数）。
- 数据质量关注：通过必填字段校验、警告和统计输出提升数据可靠性。

未来若将这部分功能迁移到后端服务：

- 可以将当前脚本拆分为独立模块（IO、清洗、校验、统计），并提供 API 触发。
- 将归档与统计结果写入数据库，而非仅落到 JSON 文件。
- 保留当前 JSON 作为“导入导出格式”，用于与其他系统集成或批量操作。

## 4.8 三个世界视角

### 4.8.1 原子世界（有空间 + 有时间）

- 流水线的触发往往来自现实动作：离职发生、数据需要归档、管理层需要某个时间点的统计结果。
- 运行脚本也受到现实约束：谁在什么时间窗口执行、用哪份数据源、是否需要审批或审计，这些都属于原子世界的组织规则。

### 4.8.2 信息世界（无空间 + 有时间）

- 本章描述的是信息世界内部的“变换”：读取 JSON → 清洗 → 校验 → 归档 → 统计 → 报告输出。
- 时间性体现在数据的先后与版本：归档文件带时间戳、归档索引记录历史、清洗报告记录本次执行的输入输出与质量指标。

### 4.8.3 AI 世界（无空间 + 存储层无时间）

- 这条流水线是 AI 世界的数据入口之一：清洗、标准化和历史归档使数据更适合作为训练与推理输入。
- 后续若引入 AI 能力，推荐把“清洗报告/统计输出/归档索引”视为稳定的特征与标签来源，形成可重复、可审计的建模闭环。
