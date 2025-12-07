import Papa from 'papaparse';
import type { Log } from '../types';

export interface ParsedLog extends Partial<Log> {
  // Extra fields for UI mapping
  originalDate?: string;
  originalTime?: string;
  originalDepth?: string;
  originalPoint?: string;
}

// Helper to parse duration string "HH:MM:SS" or "MM:SS" into minutes
const parseDuration = (str: string): number => {
  if (!str) return 0;
  const parts = str.split(':').map(Number);
  if (parts.length === 3) {
    // HH:MM:SS -> minutes
    return parts[0] * 60 + parts[1] + parts[2] / 60;
  }
  if (parts.length === 2) {
    // MM:SS -> minutes
    return parts[0] + parts[1] / 60;
  }
  // fallback for plain numbers
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

export const parseCSV = (csvContent: string): Promise<ParsedLog[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed: ParsedLog[] = results.data.map((row: any) => {
          // Garmin Japanese Standard Mapping
          // Date & Time split handling
          let dateStr = row['Date'] || row['date'] || row['Start Date'] || '';
          let timeStr = row['Time'] || row['time'] || row['Start Time'] || '';

          // Garmin "日付" contains "YYYY-MM-DD HH:mm:ss" sometimes
          const garminDate = row['日付'];
          if (garminDate) {
            const parts = garminDate.split(' ');
            if (parts.length >= 1) dateStr = parts[0];
            if (parts.length >= 2) timeStr = parts[1];
          }

          // Fields
          const titleStr = row['タイトル'] || row['Title'] || '';
          const durationStr = row['ダイブ時間'] || row['Duration'] || row['Dive Time'] || '';
          const maxDepthStr = row['最大深度'] || row['Max Depth'] || row['Max. Depth'] || row['depth'] || '';
          const avgDepthStr = row['Avg Depth'] || row['Avg. Depth'] || '';
          const tempStr = row['最低水温'] || row['Water Temp'] || row['Temp'] || '';
          const gasTypeStr = row['ガスの種類'] || '';
          const surfaceIntervalStr = row['サーフェスインターバル'] || '';
          const currentStr = row['水流']; // Light, Strong
          const waveStr = row['水面状態']; // Flat

          // Parsing
          const duration = parseDuration(durationStr);
          const surfaceInterval = parseDuration(surfaceIntervalStr);

          let maxDepth = 0;
          if (maxDepthStr) {
            const match = maxDepthStr.toString().match(/(\d+(\.\d+)?)/);
            if (match) maxDepth = parseFloat(match[0]);
          }

          let avgDepth = 0;
          if (avgDepthStr) {
            const match = avgDepthStr.toString().match(/(\d+(\.\d+)?)/);
            if (match) avgDepth = parseFloat(match[0]);
          }

          // Condition Mapping
          const condition: any = {
            waterTemp: {
              bottom: tempStr ? parseFloat(tempStr) : undefined,
            }
          };
          if (currentStr === 'Light') condition.current = 'weak';
          if (currentStr === 'Strong') condition.current = 'strong';
          if (waveStr === 'Flat') condition.wave = 'none';

          // Point mapping
          // Use 'Title' as pointName initially, user will remap.
          const pointStr = titleStr || row['Location'] || row['Place'] || row['Site'] || 'Imported Log';

          // Construct Partial Log
          const log: ParsedLog = {
            date: dateStr,
            title: titleStr, // Store original info
            time: {
              entry: timeStr,
              exit: '',
              duration: Math.round(duration), // specific decided to use minutes integer or float? App uses number.
              surfaceInterval: Math.round(surfaceInterval)
            },
            depth: {
              max: maxDepth,
              average: avgDepth
            },
            condition: condition,
            location: {
              pointId: '',
              pointName: pointStr,
              region: ''
            },
            gear: {
              tank: {
                gasType: gasTypeStr
              }
            },
            // Metadata for UI
            originalDate: dateStr,
            originalTime: timeStr,
            originalDepth: maxDepthStr,
            originalPoint: pointStr
          };
          return log;
        });

        resolve(parsed);
      },
      error: (error: Error) => {
        reject(error);
      }
    });
  });
};
