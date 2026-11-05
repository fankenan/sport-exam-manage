-- 清理冒烟测试残留数据
DELETE FROM grade_seven WHERE identity_id IN ('310101200901019001', '310101201001019099');
DELETE FROM grade_submissions WHERE file_name = 'smoke.xlsx';
