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
 * Generates granular 15-minute start times for a continuous clinical schedule.
 * This provides the dynamic granularity requested for patient selection.
 */
export const generateAvailableTimes = () => {
    const times = [];
    let currentHour = 9; // Start at 09:00 AM
    let currentMinute = 0;

    while (currentHour < 22) { // End at 10:00 PM
        const period = currentHour >= 12 ? "PM" : "AM";
        const displayHour = currentHour > 12 ? currentHour - 12 : (currentHour === 0 ? 12 : currentHour);
        const displayMinute = currentMinute.toString().padStart(2, '0');
        
        times.push(`${displayHour.toString().padStart(2, '0')}:${displayMinute} ${period}`);
        
        currentMinute += 15; // Set to 15 minutes intervals
        if (currentMinute >= 60) {
            currentMinute = 0;
            currentHour += 1;
        }
    }
    return times;
}

// Legacy slots kept for compatibility but updated to 15-min blocks
export const timeSlots = {
    morning: generateAvailableTimes().slice(0, 12),
    afternoon: generateAvailableTimes().slice(12, 24),
    evening: generateAvailableTimes().slice(24)
}
