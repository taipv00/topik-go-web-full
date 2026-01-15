// lib/examDataCache.ts
import fs from 'fs/promises';
import path from 'path';
import type { ExamData } from '../app/components/types';

const EXAMS_DATA_PATH = path.join(process.cwd(), 'data', 'data.json');

// In-memory cache để tránh đọc file 2.3MB nhiều lần
let cachedExamsData: ExamData[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour cache in production

/**
 * Get all exams with in-memory caching
 * Optimized để tránh đọc file JSON 2.3MB mỗi request
 */
export async function getAllExams(): Promise<ExamData[]> {
  try {
    // Check cache first
    const now = Date.now();
    if (cachedExamsData && (now - cacheTimestamp) < CACHE_TTL) {
      return cachedExamsData;
    }

    // Cache miss - read from disk
    const fileContent = await fs.readFile(EXAMS_DATA_PATH, 'utf-8');
    const allExamsData: ExamData[] = JSON.parse(fileContent);

    if (!Array.isArray(allExamsData)) {
      console.error('Lỗi getAllExams: Dữ liệu không phải là mảng');
      return [];
    }

    // Update cache
    cachedExamsData = allExamsData;
    cacheTimestamp = now;

    return allExamsData;
  } catch (error: any) {
    console.error('Lỗi trong getAllExams:', error.message);
    return [];
  }
}

/**
 * Get single exam by ID
 * Uses cached data from getAllExams
 */
export async function getExamData(examId: string): Promise<ExamData | null> {
  try {
    const allExamsData = await getAllExams();
    const exam = allExamsData.find(e => e.id.toString() === examId.toString());
    return exam || null;
  } catch (error: any) {
    console.error(`Lỗi khi lấy exam ${examId}:`, error.message);
    return null;
  }
}

/**
 * Clear cache manually (useful for development/testing)
 */
export function clearExamCache(): void {
  cachedExamsData = null;
  cacheTimestamp = 0;
}
