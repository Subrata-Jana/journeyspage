import React, { useState, useRef, useEffect } from "react";
import { 
  format, addMonths, subMonths, startOfMonth, 
  endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, 
  isSameMonth, isSameDay, parse 
} from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, Lock, HelpCircle } from "lucide-react";

export default function DatePicker({ label, value, onChange, disabled, feedback, isModified, tooltip }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const containerRef = useRef(null);

  // 1. Parse Initial Value (Expects "DD/MM/YYYY" string or ISO string)
  // If value is empty, we don't set a selected date.
  const selectedDate = value ? parse(value, 'dd/MM/yyyy', new Date()) : null;

  // 2. Handle Outside Clicks
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 3. Calendar Navigation
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  // 4. Generate Days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  // 5. Handle Date Click
  const onDateClick = (day) => {
    // Format strictly as DD/MM/YYYY
    const formattedDate = format(day, "dd/MM/yyyy"); 
    onChange(formattedDate);
    setIsOpen(false);
  };

  return (
    <div className="space-y-1 relative" ref={containerRef}>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1">{label}</label>
            {tooltip && (
                <div className="group relative">
                    <HelpCircle size={12} className="text-slate-400 cursor-help" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center shadow-xl">
                        {tooltip}
                        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-slate-800"></div>
                    </div>
                </div>
            )}
        </div>
      </div>

      <div className="relative">
        {/* INPUT DISPLAY */}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`w-full flex items-center justify-between bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm transition-colors text-left
            ${disabled ? "opacity-60 cursor-not-allowed" : "hover:border-orange-500 focus:border-orange-500"}
            ${feedback ? (isModified ? "border-amber-500 ring-1 ring-amber-500/20" : "border-red-500 ring-1 ring-red-500/20") : ""}
          `}
        >
          <span className={value ? "text-slate-900 dark:text-white" : "text-slate-400"}>
            {value || "DD/MM/YYYY"}
          </span>
          {disabled ? <Lock size={16} className="text-slate-400"/> : <CalendarIcon size={16} className="text-orange-500"/>}
        </button>

        {/* CALENDAR DROPDOWN */}
        {isOpen && !disabled && (
          <div className="absolute top-full left-0 mt-2 z-50 bg-white dark:bg-[#1A1F2E] border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl p-4 w-72 animate-in fade-in zoom-in-95 duration-100">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <button onClick={prevMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"><ChevronLeft size={18} className="text-slate-600 dark:text-slate-300"/></button>
              <span className="font-bold text-slate-900 dark:text-white">{format(currentMonth, "MMMM yyyy")}</span>
              <button onClick={nextMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"><ChevronRight size={18} className="text-slate-600 dark:text-slate-300"/></button>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                <div key={d} className="text-[10px] font-bold text-slate-400 uppercase">{d}</div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                // Check if this date is the selected one
                // Use strict string comparison for reliability with parsed value
                const isSelected = value === format(day, "dd/MM/yyyy");
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isToday = isSameDay(day, new Date());

                return (
                  <button
                    key={idx}
                    onClick={() => onDateClick(day)}
                    className={`
                      h-8 w-8 rounded-lg text-xs font-medium flex items-center justify-center transition-all
                      ${!isCurrentMonth ? "text-slate-300 dark:text-slate-600" : "text-slate-700 dark:text-slate-200"}
                      ${isSelected ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30 scale-110" : "hover:bg-slate-100 dark:hover:bg-white/10"}
                      ${isToday && !isSelected ? "border border-orange-500/50 text-orange-500" : ""}
                    `}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* FEEDBACK MSG */}
      {feedback && (
        <div className={`text-xs p-2 rounded-lg border flex items-start gap-2 mt-1 ${isModified ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/10 dark:text-amber-400 dark:border-amber-500/20' : 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/10 dark:text-red-400 dark:border-red-500/20'}`}>
            {isModified ? <CheckCircle2 size={14} className="mt-0.5 shrink-0"/> : <AlertCircle size={14} className="mt-0.5 shrink-0"/>}
            <span><span className="font-bold">{isModified ? 'Change Detected:' : 'Correction Needed:'}</span> {isModified ? 'Save to submit this fix.' : feedback}</span>
        </div>
      )}
    </div>
  );
}