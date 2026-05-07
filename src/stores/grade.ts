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
  verifyResult: boolean
  remark: string
}

export interface GradeEightData {
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
  verifyResult: boolean
  remark: string
}

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
}

export const useGradeStore = defineStore('grade', () => {
  const gradeSevenList = ref<GradeSevenData[]>([])
  const gradeEightList = ref<GradeEightData[]>([])
  const gradeNineList = ref<GradeNineData[]>([])
  const admissionList = ref<AdmissionData[]>([])

  const schools = computed(() => {
    const allSchools = new Set<string>()
    gradeSevenList.value.forEach(item => allSchools.add(item.school))
    gradeEightList.value.forEach(item => allSchools.add(item.school))
    gradeNineList.value.forEach(item => allSchools.add(item.school))
    return Array.from(allSchools).sort()
  })

  const graduationYears = computed(() => {
    const years = new Set<string>()
    gradeSevenList.value.forEach(item => years.add(item.graduationYear))
    gradeEightList.value.forEach(item => years.add(item.graduationYear))
    gradeNineList.value.forEach(item => years.add(item.graduationYear))
    return Array.from(years).sort()
  })

  const generateId = () => 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)

  const generateIdentityId = (idCard: string): string => {
    return idCard.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  }

  const addGradeSevenData = async (data: Omit<GradeSevenData, 'id' | 'identityId' | 'totalVerify' | 'verifyResult'>) => {
    const identityId = generateIdentityId(data.idCard)
    const totalVerify = parseFloat((data.attendanceScore + data.examScore + data.fitnessScore).toFixed(1))
    const verifyResult = Math.abs(totalVerify - data.total) < 0.1
    
    const newData: GradeSevenData = {
      ...data,
      id: generateId(),
      identityId,
      totalVerify,
      verifyResult
    }
    gradeSevenList.value.push(newData)
    await saveToStorage()
    return newData
  }

  const addGradeEightData = async (data: Omit<GradeEightData, 'id' | 'identityId' | 'totalVerify' | 'verifyResult'>) => {
    const identityId = generateIdentityId(data.idCard)
    const totalVerify = parseFloat((data.attendanceScore + data.examScore + data.fitnessScore).toFixed(1))
    const verifyResult = Math.abs(totalVerify - data.total) < 0.1
    
    const newData: GradeEightData = {
      ...data,
      id: generateId(),
      identityId,
      totalVerify,
      verifyResult
    }
    gradeEightList.value.push(newData)
    await saveToStorage()
    return newData
  }

  const addGradeNineData = async (data: Omit<GradeNineData, 'id' | 'identityId'>) => {
    const identityId = generateIdentityId(data.idCard)
    
    const newData: GradeNineData = {
      ...data,
      id: generateId(),
      identityId
    }
    gradeNineList.value.push(newData)
    await saveToStorage()
    return newData
  }

  const updateGradeSevenData = async (id: string, data: Partial<GradeSevenData>) => {
    const index = gradeSevenList.value.findIndex(item => item.id === id)
    if (index !== -1) {
      const item = gradeSevenList.value[index]
      const updated = { ...item, ...data }
      if (data.attendanceScore !== undefined || data.examScore !== undefined || data.fitnessScore !== undefined) {
        updated.totalVerify = parseFloat((updated.attendanceScore + updated.examScore + updated.fitnessScore).toFixed(1))
        updated.verifyResult = Math.abs(updated.totalVerify - updated.total) < 0.1
      }
      gradeSevenList.value[index] = updated
      // 增量更新到后端，避免全量覆盖
      try {
        await dataApi.update('grade_seven', id, data)
      } catch {
        // 降级：同步全部数据
        await saveToStorage()
      }
      return updated
    }
    return null
  }

  const updateGradeEightData = async (id: string, data: Partial<GradeEightData>) => {
    const index = gradeEightList.value.findIndex(item => item.id === id)
    if (index !== -1) {
      const item = gradeEightList.value[index]
      const updated = { ...item, ...data }
      if (data.attendanceScore !== undefined || data.examScore !== undefined || data.fitnessScore !== undefined) {
        updated.totalVerify = parseFloat((updated.attendanceScore + updated.examScore + updated.fitnessScore).toFixed(1))
        updated.verifyResult = Math.abs(updated.totalVerify - updated.total) < 0.1
      }
      gradeEightList.value[index] = updated
      try {
        await dataApi.update('grade_eight', id, data)
      } catch {
        await saveToStorage()
      }
      return updated
    }
    return null
  }

  const updateGradeNineData = async (id: string, data: Partial<GradeNineData>) => {
    const index = gradeNineList.value.findIndex(item => item.id === id)
    if (index !== -1) {
      gradeNineList.value[index] = { ...gradeNineList.value[index], ...data }
      try {
        await dataApi.update('grade_nine', id, data)
      } catch {
        await saveToStorage()
      }
      return gradeNineList.value[index]
    }
    return null
  }

  const deleteGradeSevenData = async (id: string) => {
    const index = gradeSevenList.value.findIndex(item => item.id === id)
    if (index !== -1) {
      gradeSevenList.value.splice(index, 1)
      await saveToStorage()
      return true
    }
    return false
  }

  const deleteGradeEightData = async (id: string) => {
    const index = gradeEightList.value.findIndex(item => item.id === id)
    if (index !== -1) {
      gradeEightList.value.splice(index, 1)
      await saveToStorage()
      return true
    }
    return false
  }

  const deleteGradeNineData = async (id: string) => {
    const index = gradeNineList.value.findIndex(item => item.id === id)
    if (index !== -1) {
      gradeNineList.value.splice(index, 1)
      await saveToStorage()
      return true
    }
    return false
  }

  const calculateAdmissionScores = async () => {
    // 先从服务器加载最新数据，确保年级列表是最新的
    try {
      const data = await dataApi.sync()
      if (data.gradeSevenList) gradeSevenList.value = data.gradeSevenList
      if (data.gradeEightList) gradeEightList.value = data.gradeEightList
      if (data.gradeNineList) gradeNineList.value = data.gradeNineList
      if (data.admissionList && data.admissionList.length > 0) {
        admissionList.value = data.admissionList
      }
    } catch (error) {
      console.error('从服务器加载数据失败:', error)
    }

    // 如果仍无年级数据，提示用户先导入年级成绩
    if (gradeSevenList.value.length === 0 && gradeEightList.value.length === 0 && gradeNineList.value.length === 0) {
      console.warn('请先导入七年级、八年级、九年级成绩后再进行匹配')
    }

    admissionList.value = []
    
    const studentMap = new Map<string, AdmissionData>()
    
    gradeSevenList.value.forEach(item => {
      if (!studentMap.has(item.identityId)) {
        studentMap.set(item.identityId, {
          id: generateId(),
          identityId: item.identityId,
          school: item.school,
          name: item.name,
          registrationNumber: '',
          graduationYear: item.graduationYear,
          gradeSeven: item.total,
          gradeEight: 0,
          longRun: 0,
          ropeSkipping: 0,
          longJump: 0,
          ballSports: 0,
          martialArts: 0,
          totalScore: 0
        })
      } else {
        const existing = studentMap.get(item.identityId)!
        existing.gradeSeven = item.total
      }
    })
    
    gradeEightList.value.forEach(item => {
      if (studentMap.has(item.identityId)) {
        const existing = studentMap.get(item.identityId)!
        existing.gradeEight = item.total
      }
    })
    
    gradeNineList.value.forEach(item => {
      if (studentMap.has(item.identityId)) {
        const existing = studentMap.get(item.identityId)!
        existing.longRun = item.longRun
        existing.ropeSkipping = item.ropeSkipping
        existing.longJump = item.longJump
        existing.ballSports = item.ballSports
        existing.martialArts = item.martialArts
      }
    })
    
    studentMap.forEach(student => {
      // 所有字段都 parseFloat，避免字符串 + 数字变成拼接
      student.totalScore = Math.round(
        Number(student.gradeSeven || 0) +
        Number(student.gradeEight || 0) +
        Number(student.longRun || 0) +
        Number(student.ropeSkipping || 0) +
        Number(student.longJump || 0) +
        Number(student.ballSports || 0) +
        Number(student.martialArts || 0)
      )
      admissionList.value.push(student)
    })
    
    saveToStorage()
  }

  const updateAdmissionData = async (id: string, data: Partial<AdmissionData>) => {
    const index = admissionList.value.findIndex(item => item.id === id)
    if (index !== -1) {
      const item = admissionList.value[index]
      const updated = { ...item, ...data }
      updated.totalScore = Math.round(
        Number(updated.gradeSeven || 0) +
        Number(updated.gradeEight || 0) +
        Number(updated.longRun || 0) +
        Number(updated.ropeSkipping || 0) +
        Number(updated.longJump || 0) +
        Number(updated.ballSports || 0) +
        Number(updated.martialArts || 0)
      )
      admissionList.value[index] = updated
      try {
        await dataApi.update('admission', id, data)
      } catch {
        await saveToStorage()
      }
      return updated
    }
    return null
  }

  const saveToStorage = async () => {
    try {
      // 先从服务器获取现有数据，避免覆盖其他年级
      let serverData: any = {}
      try {
        serverData = await dataApi.sync()
      } catch {
        // 无权限则跳过合并
      }
      await dataApi.syncSave({
        gradeSevenList: gradeSevenList.value.length > 0 ? gradeSevenList.value : (serverData.gradeSevenList || []),
        gradeEightList: gradeEightList.value.length > 0 ? gradeEightList.value : (serverData.gradeEightList || []),
        gradeNineList: gradeNineList.value.length > 0 ? gradeNineList.value : (serverData.gradeNineList || []),
        admissionList: admissionList.value.length > 0 ? admissionList.value : (serverData.admissionList || [])
      })
    } catch (error) {
      console.error('数据同步失败:', error)
    }
  }

  const loadFromStorage = async () => {
    // 未登录时跳过加载，不报错
    if (!localStorage.getItem('token')) return
    try {
      const data = await dataApi.sync()
      if (data.gradeSevenList) gradeSevenList.value = data.gradeSevenList
      if (data.gradeEightList) gradeEightList.value = data.gradeEightList
      if (data.gradeNineList) gradeNineList.value = data.gradeNineList
      if (data.admissionList) admissionList.value = data.admissionList
    } catch (error) {
      console.error('数据加载失败:', error)
    }
  }

  /**
   * 检查身份证号是否重复
   * 逻辑：在所有年级列表中查找该身份证号，如果找到的记录与当前导入的年级一致，则判定为重复
   * @param idCard 身份证号
   * @param grade 当前导入的年级
   * @param gradeValue 年级列中的内容（如"七年级"、"八年级"、"九年级"）
   */
  const checkDuplicateIdCard = (idCard: string, grade: 'seven' | 'eight' | 'nine', gradeValue?: string): Array<{school: string, name: string, idCard: string}> => {
    const duplicates: Array<{school: string, name: string, idCard: string}> = []
    const identityId = generateIdentityId(idCard)

    // 年级名称映射：将用户填写的年级内容标准化
    const normalizeGrade = (g: string): string => {
      if (!g) return ''
      const s = g.replace(/\s/g, '')
      if (s.includes('七') || s.includes('7') || s.includes('初一')) return 'seven'
      if (s.includes('八') || s.includes('8') || s.includes('初二')) return 'eight'
      if (s.includes('九') || s.includes('9') || s.includes('初三')) return 'nine'
      return s
    }

    // 当前导入的标准化年级
    const currentGrade = gradeValue ? normalizeGrade(gradeValue) : grade

    // 在所有年级列表中查找该身份证号
    const allLists: { list: any[], gradeKey: string }[] = [
      { list: gradeSevenList.value, gradeKey: 'seven' },
      { list: gradeEightList.value, gradeKey: 'eight' },
      { list: gradeNineList.value, gradeKey: 'nine' }
    ]

    allLists.forEach(({ list, gradeKey }) => {
      list.forEach(item => {
        if (item.identityId === identityId) {
          // 找到相同身份证号，检查年级是否一致
          if (gradeKey === currentGrade) {
            duplicates.push({
              school: item.school,
              name: item.name,
              idCard: item.idCard
            })
          }
          // 年级不一致则不算重复，正常导入
        }
      })
    })

    return duplicates
  }

  const searchByNameOrIdCard = (keyword: string) => {
    const results = {
      seven: gradeSevenList.value.filter(item => 
        item.name.includes(keyword) || item.idCard.includes(keyword) || item.identityId.includes(keyword)
      ),
      eight: gradeEightList.value.filter(item => 
        item.name.includes(keyword) || item.idCard.includes(keyword) || item.identityId.includes(keyword)
      ),
      nine: gradeNineList.value.filter(item => 
        item.name.includes(keyword) || item.idCard.includes(keyword) || item.identityId.includes(keyword)
      )
    }
    return results
  }

  return {
    gradeSevenList,
    gradeEightList,
    gradeNineList,
    admissionList,
    schools,
    graduationYears,
    generateIdentityId,
    addGradeSevenData,
    addGradeEightData,
    addGradeNineData,
    updateGradeSevenData,
    updateGradeEightData,
    updateGradeNineData,
    deleteGradeSevenData,
    deleteGradeEightData,
    deleteGradeNineData,
    calculateAdmissionScores,
    updateAdmissionData,
    saveToStorage,
    loadFromStorage,
    checkDuplicateIdCard,
    searchByNameOrIdCard
  }
})
