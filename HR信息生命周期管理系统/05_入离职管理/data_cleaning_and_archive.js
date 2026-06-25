const fs = require('fs');
const path = require('path');

// 定义输出目录
const OUTPUT_DIR = "C:\\ShareHub\\HR系统恢复验证\\HR信息生命周期管理系统\\05_入离职管理";
const ARCHIVE_DIR = path.join(OUTPUT_DIR, "03_离职办理阶段", "非敏感信息");
const ACTIVE_DIR = path.join(OUTPUT_DIR, "02_在职期间管理", "非敏感信息");
const DATA_SOURCE_ACTIVE = "C:\\ShareHub\\HR系统恢复验证\\HR信息生命周期管理系统\\05_入离职管理\\02_在职期间管理\\非敏感信息";
const DATA_SOURCE_RESIGNED = "C:\\ShareHub\\HR系统恢复验证\\HR信息生命周期管理系统\\05_入离职管理\\03_离职办理阶段\\非敏感信息";

console.log("=== HR系统数据清洗和归档工具 ===\n");

// 创建归档目录
function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`✓ 创建目录: ${dirPath}`);
    }
}

// 读取JSON文件
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

// 写入JSON文件
function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`× 写入文件失败: ${filePath}`, error.message);
        return false;
    }
}

// 步骤1: 读取原始员工数据
console.log("步骤1: 读取原始员工数据...");
ensureDirectoryExists(ARCHIVE_DIR);
ensureDirectoryExists(ACTIVE_DIR);

// 读取在职员工数据
const activeEmployeesFile = path.join(DATA_SOURCE_ACTIVE, "在职员工信息.json");
const activeEmployees = readJsonFile(activeEmployeesFile);

// 读取离职员工数据
const resignedEmployeesFile = path.join(DATA_SOURCE_RESIGNED, "离职员工信息.json");
const resignedEmployees = readJsonFile(resignedEmployeesFile);

if (!activeEmployees || !resignedEmployees) {
    console.error("× 无法读取员工数据文件");
    process.exit(1);
}

console.log(`✓ 在职员工: ${activeEmployees.length}人`);
console.log(`✓ 离职员工: ${resignedEmployees.length}人`);

// 步骤2: 数据清洗 - 验证和清理数据
console.log("\n步骤2: 数据清洗和验证...");

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

// 清洗在职员工数据 - 跳过第一行（标题行）
const cleanedActiveEmployees = activeEmployees.slice(1).map(cleanEmployeeData);
console.log(`✓ 在职员工数据清洗完成: ${cleanedActiveEmployees.length}人`);

// 清洗离职员工数据 - 跳过第一行（标题行）
const cleanedResignedEmployees = resignedEmployees.slice(1).map(cleanEmployeeData);
console.log(`✓ 离职员工数据清洗完成: ${cleanedResignedEmployees.length}人`);

// 步骤3: 数据验证和统计
console.log("\n步骤3: 数据验证和统计...");

// 验证数据完整性
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

    console.log(`  ${type}:`);
    console.log(`    - 有效记录: ${validCount}`);
    console.log(`    - 无效记录: ${invalidCount}`);

    if (issues.length > 0 && issues.length <= 5) {
        console.log(`    - 问题详情:`);
        issues.forEach(issue => {
            console.log(`      ${issue.name}: 缺少${issue.missingFields}`);
        });
    }

    return { validCount, invalidCount, issues };
}

validateDataIntegrity(cleanedActiveEmployees, "在职员工");
validateDataIntegrity(cleanedResignedEmployees, "离职员工");

// 步骤4: 归档离职员工数据
console.log("\n步骤4: 归档离职员工数据...");

// 创建归档时间戳
const archiveTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

// 保存离职员工归档数据
const archivedResignedEmployees = {
    archiveInfo: {
        archivedAt: new Date().toISOString(),
        totalRecords: cleanedResignedEmployees.length,
        archiveReason: "离职员工数据归档",
        version: "1.0"
    },
    employees: cleanedResignedEmployees
};

const archiveFile = path.join(ARCHIVE_DIR, `离职员工归档_${archiveTimestamp}.json`);
if (writeJsonFile(archiveFile, archivedResignedEmployees)) {
    console.log(`✓ 离职员工数据已归档: ${archiveFile}`);
}

// 创建归档索引
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

const archiveIndexFile = path.join(ARCHIVE_DIR, "归档索引.json");
writeJsonFile(archiveIndexFile, archiveIndex);
console.log(`✓ 归档索引已创建: ${archiveIndexFile}`);

// 步骤5: 更新在职员工数据
console.log("\n步骤5: 更新在职员工数据...");

const activeEmployeesData = {
    lastUpdated: new Date().toISOString(),
    totalRecords: cleanedActiveEmployees.length,
    dataSource: "HR系统在职员工数据",
    version: "1.0",
    employees: cleanedActiveEmployees
};

const activeEmployeesFile_new = path.join(ACTIVE_DIR, "在职员工信息_清洗后.json");
if (writeJsonFile(activeEmployeesFile_new, activeEmployeesData)) {
    console.log(`✓ 在职员工数据已更新: ${activeEmployeesFile_new}`);
}

// 步骤6: 生成数据清洗报告
console.log("\n步骤6: 生成数据清洗报告...");

const cleaningReport = {
    reportTime: new Date().toISOString(),
    summary: {
        originalActiveEmployees: activeEmployees.length,
        originalResignedEmployees: resignedEmployees.length,
        cleanedActiveEmployees: cleanedActiveEmployees.length,
        cleanedResignedEmployees: cleanedResignedEmployees.length,
        archivedResignedEmployees: cleanedResignedEmployees.length
    },
    dataQuality: {
        activeEmployees: {
            validRecords: cleanedActiveEmployees.filter(emp => emp['雇员编号'] && emp['姓名'] && emp['部门']).length,
            invalidRecords: cleanedActiveEmployees.filter(emp => !(emp['雇员编号'] && emp['姓名'] && emp['部门'])).length
        },
        resignedEmployees: {
            validRecords: cleanedResignedEmployees.filter(emp => emp['雇员编号'] && emp['姓名'] && emp['部门']).length,
            invalidRecords: cleanedResignedEmployees.filter(emp => !(emp['雇员编号'] && emp['姓名'] && emp['部门'])).length
        }
    },
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

const reportFile = path.join(OUTPUT_DIR, "数据清洗和归档报告.json");
writeJsonFile(reportFile, cleaningReport);
console.log(`✓ 数据清洗报告已生成: ${reportFile}`);

// 步骤7: 更新系统统计信息
console.log("\n步骤7: 更新系统统计信息...");

// 生成在职员工统计
const activeStats = {
    lastUpdated: new Date().toISOString(),
    totalEmployees: cleanedActiveEmployees.length,
    departmentDistribution: {},
    positionDistribution: {},
    locationDistribution: {},
    genderDistribution: { male: 0, female: 0, unknown: 0 }
};

// 统计部门分布
cleanedActiveEmployees.forEach(emp => {
    const dept = emp['部门'] || '未知';
    activeStats.departmentDistribution[dept] = (activeStats.departmentDistribution[dept] || 0) + 1;
});

// 统计职位分布
cleanedActiveEmployees.forEach(emp => {
    const position = emp['职位'] || '未知';
    activeStats.positionDistribution[position] = (activeStats.positionDistribution[position] || 0) + 1;
});

// 统计地点分布
cleanedActiveEmployees.forEach(emp => {
    const location = emp['工作地点'] || '未知';
    activeStats.locationDistribution[location] = (activeStats.locationDistribution[location] || 0) + 1;
});

// 统计性别分布
cleanedActiveEmployees.forEach(emp => {
    const gender = emp['性别'];
    if (gender === '男') {
        activeStats.genderDistribution.male++;
    } else if (gender === '女') {
        activeStats.genderDistribution.female++;
    } else {
        activeStats.genderDistribution.unknown++;
    }
});

const statsFile = path.join(ACTIVE_DIR, "在职员工统计信息.json");
writeJsonFile(statsFile, activeStats);
console.log(`✓ 统计信息已更新: ${statsFile}`);

console.log("\n=== 数据清洗和归档完成 ===");
console.log(`总处理记录: ${activeEmployees.length + resignedEmployees.length}条`);
console.log(`在职员工: ${cleanedActiveEmployees.length}人`);
console.log(`离职员工: ${cleanedResignedEmployees.length}人 (已归档)`);
console.log(`归档文件: ${archiveFile}`);
console.log(`统计文件: ${statsFile}`);
