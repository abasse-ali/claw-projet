// Calendrier mensuel montrant les jours avec rentrées (salaire) et dépenses.
// Les jours sont colorés : vert pour rentrée, rouge pour dépense, les deux = les deux points.

import { useMemo, useState } from "react";
import { useEntries } from "./store";
import { inMonth } from "./store";
import { monthOf, today, shiftMonth, monthName, dayLabel, money, signed } from "./format";
import { Calendar, ChevronLeft, ChevronRight, Plus, Minus } from "lucide-react";
import { Icon } from "./icons";

type DayData = {
  date: string;
  day: number;
  income: number;
  spending: number;
  hasIncome: boolean;
  hasSpending: boolean;
  isToday: boolean;
  isCurrentMonth: boolean;
};

function useMonthDays(month: string, entries: import("./store").Entry[]): DayData[] {
  const monthEntries = useMemo(() => inMonth(entries, month), [entries, month]);
  
  return useMemo(() => {
    const [year, monthNum] = month.split("-").map(Number);
    const firstDay = new Date(year, monthNum - 1, 1).getDay(); // 0 = dimanche
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    
    // Grouper par jour
    const byDay = new Map<number, { income: number; spending: number }>();
    for (const entry of monthEntries) {
      const day = parseInt(entry.date.split("-")[2], 10);
      const current = byDay.get(day) || { income: 0, spending: 0 };
      if (entry.amount > 0) current.income += entry.amount;
      else current.spending += Math.abs(entry.amount);
      byDay.set(day, current);
    }
    
    const days: DayData[] = [];
    
    // Jours du mois précédent (pour remplir la première semaine)
    const prevMonth = shiftMonth(month, -1);
    const [prevYear, prevMonthNum] = prevMonth.split("-").map(Number);
    const prevDaysInMonth = new Date(prevYear, prevMonthNum, 0).getDate();
    
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = prevDaysInMonth - i;
      days.push({
        date: `${prevYear}-${String(prevMonthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        day,
        income: 0,
        spending: 0,
        hasIncome: false,
        hasSpending: false,
        isToday: false,
        isCurrentMonth: false,
      });
    }
    
    // Jours du mois courant
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const data = byDay.get(day) || { income: 0, spending: 0 };
      days.push({
        date: dateStr,
        day,
        income: data.income,
        spending: data.spending,
        hasIncome: data.income > 0,
        hasSpending: data.spending > 0,
        isToday: dateStr === todayStr,
        isCurrentMonth: true,
      });
    }
    
    // Jours du mois suivant (pour remplir la dernière semaine)
    const nextMonth = shiftMonth(month, 1);
    const [nextYear, nextMonthNum] = nextMonth.split("-").map(Number);
    const remaining = (7 - (days.length % 7)) % 7;
    for (let day = 1; day <= remaining; day++) {
      days.push({
        date: `${nextYear}-${String(nextMonthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        day,
        income: 0,
        spending: 0,
        hasIncome: false,
        hasSpending: false,
        isToday: false,
        isCurrentMonth: false,
      });
    }
    
    return days;
  }, [monthEntries, month]);
}

export function MonthCalendar({ month: initialMonth }: { month?: string }) {
  const [month, setMonth] = useState(initialMonth || monthOf(today()));
  const entries = useEntries((state) => state.entries);
  const days = useMonthDays(month, entries);
  
  const goPrev = () => setMonth(shiftMonth(month, -1));
  const goNext = () => setMonth(shiftMonth(month, 1));
  const goToday = () => setMonth(monthOf(today()));
  
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  
  const weeks = useMemo(() => {
    const result: DayData[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);
  
  const monthEntries = inMonth(entries, month);
  const totalIncome = monthEntries.filter(e => e.amount > 0).reduce((sum, e) => sum + e.amount, 0);
  const totalSpending = Math.abs(monthEntries.filter(e => e.amount < 0).reduce((sum, e) => sum + e.amount, 0));
  
  return (
    <div className="calendar">
      <div className="calendar__header">
        <button className="calendar__nav" onClick={goPrev} aria-label="Mois précédent">
          <Icon icon={ChevronLeft} size={20} />
        </button>
        <button 
          className="calendar__title" 
          onClick={goToday}
          aria-label="Aller au mois courant"
        >
          {monthName(month)}
        </button>
        <button className="calendar__nav" onClick={goNext} aria-label="Mois suivant">
          <Icon icon={ChevronRight} size={20} />
        </button>
      </div>
      
      <div className="calendar__weekdays">
        {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((day, i) => (
          <div key={i} className="calendar__weekday">{day}</div>
        ))}
      </div>
      
      <div className="calendar__grid" role="grid" aria-label={monthName(month)}>
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="calendar__week" role="row">
            {week.map((dayData, dayIndex) => (
              <button
                key={dayData.date}
                className={`calendar__day${!dayData.isCurrentMonth ? " calendar__day--other" : ""}${dayData.isToday ? " calendar__day--today" : ""}${dayData.hasIncome ? " calendar__day--income" : ""}${dayData.hasSpending ? " calendar__day--spending" : ""}${selectedDay?.date === dayData.date ? " calendar__day--selected" : ""}`}
                onClick={() => setSelectedDay(selectedDay?.date === dayData.date ? null : dayData)}
                disabled={!dayData.isCurrentMonth}
                role="gridcell"
                aria-label={`${dayData.day} ${monthName(month)}${dayData.hasIncome ? `, rentrée ${money(dayData.income)}` : ""}${dayData.hasSpending ? `, dépense ${money(dayData.spending)}` : ""}`}
                aria-selected={selectedDay?.date === dayData.date}
              >
                <span className="calendar__day-number">{dayData.day}</span>
                <div className="calendar__day-dots">
                  {dayData.hasIncome && <span className="calendar__dot calendar__dot--income" aria-hidden="true" />}
                  {dayData.hasSpending && <span className="calendar__dot calendar__dot--spending" aria-hidden="true" />}
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
      
      {selectedDay && (
        <div className="calendar__detail" role="dialog" aria-label={`Détails du ${dayLabel(selectedDay.date)}`}>
          <div className="calendar__detail-header">
            <span>{dayLabel(selectedDay.date)} {monthName(month)}</span>
            <button 
              className="calendar__close" 
              onClick={() => setSelectedDay(null)}
              aria-label="Fermer"
            >
              <Icon icon={Calendar} size={18} />
            </button>
          </div>
          <div className="calendar__detail-content">
            {selectedDay.hasIncome && (
              <div className="calendar__detail-row calendar__detail-row--income">
                <Icon icon={Plus} size={16} />
                <span>Rentrée</span>
                <span className="calendar__detail-amount">{money(selectedDay.income)}</span>
              </div>
            )}
            {selectedDay.hasSpending && (
              <div className="calendar__detail-row calendar__detail-row--spending">
                <Icon icon={Minus} size={16} />
                <span>Dépense</span>
                <span className="calendar__detail-amount">{money(selectedDay.spending)}</span>
              </div>
            )}
            {!selectedDay.hasIncome && !selectedDay.hasSpending && (
              <p className="calendar__detail-empty">Aucune opération ce jour-là.</p>
            )}
          </div>
        </div>
      )}
      
      <div className="calendar__summary">
        <div className="calendar__summary-item calendar__summary-item--income">
          <Icon icon={Plus} size={16} />
          <span>Rentrées</span>
          <b>{money(totalIncome)}</b>
        </div>
        <div className="calendar__summary-item calendar__summary-item--spending">
          <Icon icon={Minus} size={16} />
          <span>Dépenses</span>
          <b>{money(totalSpending)}</b>
        </div>
        <div className="calendar__summary-item calendar__summary-item--balance">
          <Icon icon={Calendar} size={16} />
          <span>Solde</span>
          <b>{signed(totalIncome - totalSpending)}</b>
        </div>
      </div>
    </div>
  );
}