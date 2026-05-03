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

export const timeSlots = {
    morning: ["08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM"],
    afternoon: ["02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"],
    evening: ["06:00 PM", "07:00 PM", "08:00 PM", "09:00 PM"]
}
