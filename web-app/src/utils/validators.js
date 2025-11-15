export const isValidAttendanceCode = (code) => /^[0-9]{6}$/.test(code);

export const isValidEmail = (email) => /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email ?? '');

export const isStrongPassword = (password) => (password ?? '').length >= 6;
