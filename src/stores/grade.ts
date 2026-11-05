import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { dataApi } from '@/api'

export interface GradeSevenData {
  id: string
  school: string
  name: string
  idCard: string
  identityId: string
  studentNumber: string
  graduationYear: string
  grade: string
  attendanceScore: number
  examScore: number
  fitnessScore: number
  total: number
  totalVerify: number
  verifyResult: boolean | number
  remark: string
  reviewStatus?: string | null
}

export interface GradeEightData extends GradeSevenData {}

export interface GradeNineData {
  id: string
  school: string
  name: string
  idCard: string
  identityId: string
  studentNumber: string
  graduationYear: string
  grade: string
  longRun: number
  ropeSkipping: number
  longJump: number
  ballSports: number
  martialArts: number
  remark: string
  reviewStatus?: string | null
}

export interface AdmissionData {
  id: string
  identityId: string
  school: string
  name: string
  registrationNumber: string
  graduationYear: string
  gradeSeven: number
  gradeEight: number
  longRun: number
  ropeSkipping: number
  longJump: number
  ballSports: number
  martialArts: number
  totalScore: number
  reviewStatus?: string | null
}

/**
 * 成绩数据 Store
 *
 * 设计原则（相对旧版的关键改动）：
 *  1. 不再在启动时拉取全量数据 —— 列表页一律走服务端分页
 *  2. 不再「改一条记录就回写全库」—— 增删改一律走单条增量接口
 *  3. 本地数组仅作为「当前页缓存」，用于编辑后的即时回显
 */
export const useGradeStore = defineStore('grade', () => {
  const gradeSevenList = ref<GradeSevenData[]>([])
  const gradeEightList = ref<GradeEightData[]>([])
  const gradeNineList = ref<GradeNineData[]>([])
  const admissionList = ref<AdmissionData[]>([])

  const schools = computed(() => {
    const allSchools = new Set<string>()
    gradeSevenList.value.forEach(item => item.school && allSchools.add(item.school))
    gradeEightList.value.forEach(item => item.school && allSchools.add(item.school))
    gradeNineList.value.forEach(item => item.school && allSchools.add(item.school))
    return Array.from(allSchools).sort()
  })

  const graduationYears = computed(() => {
    const years = new Set<string>()
    gradeSevenList.value.forEach(item => item.graduationYear && years.add(item.graduationYear))
    gradeEightList.value.forEach(item => item.graduationYear && years.add(item.graduationYear))
    gradeNineList.value.forEach(item => item.graduationYear && years.add(item.graduationYear))
    return Array.from(years).sort()
  })

  const generateId = () => 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11)

  /** 身份证号 → 规范身份标识（与后端一致） */
  const generateIdentityId = (idCard: string): string =>
    String(idCard || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()

  /** 计算校对值：三项之和 */
  const computeTotalVerify = (attendance: any, exam: any, fitness: any): number =>
    parseFloat(((Number(attendance) || 0) + (Number(exam) || 0) + (Number(fitness) || 0)).toFixed(1))

  /** 校对是否通过（误差 0.1 以内视为通过） */
  const isVerified = (totalVerify: number, total: any): boolean =>
    Math.abs(totalVerify - (Number(total) || 0)) < 0.1

  /** 去掉服务端负责计算的派生字段，避免两处规则不一致 */
  const stripDerived = <T extends Record<string, any>>(data: T): Partial<T> => {
    const { totalVerify, verifyResult, ...rest } = data as any
    return rest as Partial<T>
  }

  // ========== 单条更新（增量写库） ==========

  const updateGradeSevenData = async (id: string, data: Partial<GradeSevenData>) => {
    const index = gradeSevenList.value.findIndex(item => item.id === id)
    if (index === -1) return null

    const item = gradeSevenList.value[index]
    const updated: GradeSevenData = { ...item, ...data }

    // 本地先算一遍用于即时回显；写库时只提交原始字段，
    // 合计校对与校对结果由服务端统一计算（避免两处规则不一致）
    if (data.attendanceScore !== undefined || data.examScore !== undefined || data.fitnessScore !== undefined || data.total !== undefined) {
      updated.totalVerify = computeTotalVerify(updated.attendanceScore, updated.examScore, updated.fitnessScore)
      updated.verifyResult = isVerified(updated.totalVerify, updated.total)
    }

    await dataApi.update('grade_seven', id, stripDerived(data))
    gradeSevenList.value[index] = updated
    return updated
  }

  const updateGradeEightData = async (id: string, data: Partial<GradeEightData>) => {
    const index = gradeEightList.value.findIndex(item => item.id === id)
    if (index === -1) return null

    const item = gradeEightList.value[index]
    const updated: GradeEightData = { ...item, ...data }

    if (data.attendanceScore !== undefined || data.examScore !== undefined || data.fitnessScore !== undefined || data.total !== undefined) {
      updated.totalVerify = computeTotalVerify(updated.attendanceScore, updated.examScore, updated.fitnessScore)
      updated.verifyResult = isVerified(updated.totalVerify, updated.total)
    }

    await dataApi.update('grade_eight', id, stripDerived(data))
    gradeEightList.value[index] = updated
    return updated
  }

  const updateGradeNineData = async (id: string, data: Partial<GradeNineData>) => {
    const index = gradeNineList.value.findIndex(item => item.id === id)
    if (index === -1) return null
    const updated: GradeNineData = { ...gradeNineList.value[index], ...data }
    await dataApi.update('grade_nine', id, data)
    gradeNineList.value[index] = updated
    return updated
  }

  const updateAdmissionData = async (id: string, data: Partial<AdmissionData>) => {
    const index = admissionList.value.findIndex(item => item.id === id)
    if (index === -1) return null
    const updated: AdmissionData = { ...admissionList.value[index], ...data }
    await dataApi.update('admission', id, data)
    admissionList.value[index] = updated
    return updated
  }

  // ========== 单条删除（增量写库） ==========

  const removeGradeData = async (table: 'grade_seven' | 'grade_eight' | 'grade_nine' | 'admission', id: string) => {
    await dataApi.delete(table, id)
    if (table === 'grade_seven') {
      gradeSevenList.value = gradeSevenList.value.filter(i => i.id !== id)
    } else if (table === 'grade_eight') {
      gradeEightList.value = gradeEightList.value.filter(i => i.id !== id)
    } else if (table === 'grade_nine') {
      gradeNineList.value = gradeNineList.value.filter(i => i.id !== id)
    } else {
      admissionList.value = admissionList.value.filter(i => i.id !== id)
    }
    return true
  }

  const deleteGradeSevenData = (id: string) => removeGradeData('grade_seven', id)
  const deleteGradeEightData = (id: string) => removeGradeData('grade_eight', id)
  const deleteGradeNineData = (id: string) => removeGradeData('grade_nine', id)

  // ========== 本地缓存写入（供列表页编辑后回显） ==========

  const setGradeSevenList = (list: GradeSevenData[]) => { gradeSevenList.value = list }
  const setGradeEightList = (list: GradeEightData[]) => { gradeEightList.value = list }
  const setGradeNineList = (list: GradeNineData[]) => { gradeNineList.value = list }
  const setAdmissionList = (list: AdmissionData[]) => { admissionList.value = list }

  const clearCache = () => {
    gradeSevenList.value = []
    gradeEightList.value = []
    gradeNineList.value = []
    admissionList.value = []
  }

  return {
    gradeSevenList,
    gradeEightList,
    gradeNineList,
    admissionList,
    schools,
    graduationYears,
    generateIdentityId,
    generateId,
    computeTotalVerify,
    isVerified,
    updateGradeSevenData,
    updateGradeEightData,
    updateGradeNineData,
    updateAdmissionData,
    deleteGradeSevenData,
    deleteGradeEightData,
    deleteGradeNineData,
    removeGradeData,
    setGradeSevenList,
    setGradeEightList,
    setGradeNineList,
    setAdmissionList,
    clearCache,
  }
})
