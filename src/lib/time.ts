
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
 * Now uses 1-minute intervals as requested.
 */
export const generateAvailableTimes = () => {
    const times = [];
    for (let hour = 10; hour < 21; hour++) {
        if (hour === 13) continue; // Lunch break
        for (let minute = 0; minute < 60; minute++) {
            const period = hour >= 12 ? "PM" : "AM";
            const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
            const displayMinute = minute.toString().padStart(2, '0');
            times.push(`${displayHour.toString().padStart(2, '0')}:${displayMinute} ${period}`);
        }
    }
    return times;
}

const allTimes = generateAvailableTimes();
export const timeSlots = {
    morning: allTimes.filter(t => t.includes('AM')),
    afternoon: allTimes.filter(t => t.includes('PM') && (parseInt(t.split(':')[0]) === 12 || (parseInt(t.split(':')[0]) >= 1 && parseInt(t.split(':')[0]) < 5))),
    evening: allTimes.filter(t => t.includes('PM') && parseInt(t.split(':')[0]) >= 5 && parseInt(t.split(':')[0]) < 9)
}
