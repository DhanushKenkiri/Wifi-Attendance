import { useCallback } from 'react';
import { ref, get, set } from 'firebase/database';
import { database } from '../utils/firebase.js';

const CAPTIVE_HOSTS = new Set(['192.168.137.1', 'localhost']);

export const useAttendance = () => {
  const detectNetworkMode = useCallback(() => {
    const hostname = window.location.hostname;
    return CAPTIVE_HOSTS.has(hostname);
  }, []);

  const verifyCode = useCallback(
    async (code) => {
      try {
        const trimmedCode = code.trim();
        const codesRef = ref(database, 'attendance_codes');
        const snapshot = await get(codesRef);

        if (!snapshot.exists()) {
          return {
            success: false,
            error: 'No active attendance codes available.',
          };
        }

        const codes = snapshot.val();
        let matchedCode = null;
        let classId = null;

        for (const [id, data] of Object.entries(codes)) {
          if (String(data.code) === trimmedCode) {
            matchedCode = data;
            classId = id;
            break;
          }
        }

        if (!matchedCode) {
          return {
            success: false,
            error: 'Invalid attendance code.',
          };
        }

        const now = Date.now();
        if (now > matchedCode.expiryTime) {
          return {
            success: false,
            error: 'This code has expired. Please ask your teacher for a new code.',
          };
        }

        return {
          success: true,
          data: {
            ...matchedCode,
            classId,
            isPortalMode: detectNetworkMode(),
          },
        };
      } catch (error) {
        console.error('Code verification error:', error);
        return {
          success: false,
          error: 'Network error. Please check your connection and try again.',
        };
      }
    },
    [detectNetworkMode],
  );

  const getClientIP = useCallback(async () => {
    try {
      const response = await fetch('/api/client-ip');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.warn('Unable to resolve client IP', error);
      return 'unknown';
    }
  }, []);

  const markAttendance = useCallback(
    async (studentId, codeData) => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const attendanceRef = ref(database, `attendance/${codeData.classId}/${studentId}`);
        const snapshot = await get(attendanceRef);

        if (snapshot.exists()) {
          const existingData = snapshot.val();
          if (existingData.date === today) {
            return {
              success: false,
              error: 'You have already marked attendance for this class today.',
            };
          }
        }

        const studentRef = ref(database, `students/${studentId}`);
        const studentSnapshot = await get(studentRef);

        if (!studentSnapshot.exists()) {
          return {
            success: false,
            error: 'Student data not found.',
          };
        }

        const studentData = studentSnapshot.val();
        const timestamp = Date.now();

        const attendanceData = {
          name: studentData.name,
          email: studentData.email || `${studentId}@uohyd.ac.in`,
          studentId,
          timestamp,
          markedAt: new Date(timestamp).toISOString(),
          date: today,
          subject: codeData.subject || 'N/A',
          code: codeData.code,
          manualEntry: false,
          teacherName: codeData.teacherName,
          classId: codeData.classId,
          department: codeData.department || studentData.department,
          markedVia: codeData.isPortalMode ? 'Captive Portal' : 'Web App',
        };

        await set(attendanceRef, attendanceData);

        if (codeData.isPortalMode) {
          try {
            await fetch('/api/grant-access', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                studentId,
                ipAddress: await getClientIP(),
              }),
            });
          } catch (err) {
            console.warn('Portal access grant failed:', err);
          }
        }

        return {
          success: true,
          data: attendanceData,
        };
      } catch (error) {
        console.error('Attendance marking error:', error);
        return {
          success: false,
          error: 'Failed to mark attendance. Please try again.',
        };
      }
    },
    [getClientIP],
  );

  return {
    verifyCode,
    markAttendance,
    detectNetworkMode,
  };
};
