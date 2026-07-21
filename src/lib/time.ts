
export const getNext7Days = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const next7Days = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        next7Days.push({
            date: date,
            dayName: days[date.getDay()],
            dayNumber: date.getDate(),
            fullDayName: days[date.getDay()] 
        });
    }
    return next7Days;
}

/**
 * Generates granular clinical time slots for the selector.
 * Extended limit: Til 5:00 AM.
 */
export const generateAvailableTimes = () => {
    const times = [];
    // We want 10 AM to 5 AM next day.
    // Standard Day Hours: 10, 11 AM | 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 PM
    // Early Morning Hours: 12, 1, 2, 3, 4, 5 AM
    const hRange = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5];
    
    for (const h of hRange) {
        if (h === 13) continue; // Lunch break at 1 PM
        
        const period = (h >= 12) ? "PM" : "AM";
        const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
        
        for (let minute = 0; minute < 60; minute++) {
            const displayMinute = minute.toString().padStart(2, '0');
            times.push(`${displayHour.toString().padStart(2, '0')}:${displayMinute} ${period}`);
        }
    }
    return times;
}

const allTimes = generateAvailableTimes();
export const timeSlots = {
    morning: allTimes.filter(t => t.includes('AM') && (parseInt(t.split(':')[0]) >= 10 && parseInt(t.split(':')[0]) < 12)),
    afternoon: allTimes.filter(t => t.includes('PM') && (parseInt(t.split(':')[0]) === 12 || (parseInt(t.split(':')[0]) >= 1 && parseInt(t.split(':')[0]) < 5))),
    evening: allTimes.filter(t => t.includes('PM') && parseInt(t.split(':')[0]) >= 5 && parseInt(t.split(':')[0]) < 9),
    night: allTimes.filter(t => (t.includes('PM') && parseInt(t.split(':')[0]) >= 9) || (t.includes('AM') && (parseInt(t.split(':')[0]) === 12 || parseInt(t.split(':')[0]) < 6)))
}
