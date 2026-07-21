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
 * Generates granular 20-minute start times for a precision clinical schedule.
 * Protocol: 15-minute consultation + 5-minute administrative buffer.
 * Shift: 10:00 AM - 09:00 PM
 * Break: 01:00 PM - 02:00 PM
 */
export const generateAvailableTimes = () => {
    const times = [];
    // Start at 10:00 AM (Hour 10)
    // End before 09:00 PM (Hour 21)
    for (let hour = 10; hour < 21; hour++) {
        // Skip Break: 01:00 PM - 02:00 PM (Hour 13)
        if (hour === 13) continue;

        // Intervals of 20 minutes: 00, 20, 40
        for (let minute = 0; minute < 60; minute += 20) {
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
    afternoon: allTimes.filter(t => t.includes('PM') && (parseInt(t.split(':')[0]) === 12 || (parseInt(t.split(':')[0]) >= 2 && parseInt(t.split(':')[0]) < 5))),
    evening: allTimes.filter(t => t.includes('PM') && parseInt(t.split(':')[0]) >= 5 && parseInt(t.split(':')[0]) < 9)
}
