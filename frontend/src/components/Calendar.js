import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useApi, useAuthApi } from "../hooks/api/axiosInterceptor";
import { getOrganizationColor } from '../utils/organizationColors';
import { listHolidays } from '../services/holidayService';
import { clampW, clampH } from "../styles/theme";

const CalendarWrapper = styled.div`
  width: 100%;
  max-width: ${clampW(1400)};
  margin: 0 auto;
  padding: ${clampW(32)};
`;

const CalendarContainer = styled.div`
  display: flex;
  gap: ${clampW(32)};

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const CalendarSection = styled.div`
  flex: 1;
`;

const CalendarHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${clampH(16)};
`;

const MonthYearDisplay = styled.h2`
  font-size: 1.5rem;
  font-weight: bold;
`;

const NavigationButtons = styled.div`
  display: flex;
  gap: ${clampW(16)};
`;

const NavButton = styled.button`
  padding: ${clampH(8)} ${clampW(16)};
  background-color: #2056ad;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background-color: #1a4786;
  }
`;

const WeekDays = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: ${clampH(8)};
`;

const WeekDayLabel = styled.div`
  text-align: center;
  font-weight: bold;
  padding: ${clampW(8)};
`;

const CalendarGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  border: 1px solid #ddd;
`;

const DayCell = styled.div`
  min-height: ${clampH(80)};
  border: 1px solid #ddd;
  padding: ${clampW(8)};
  background-color: ${props =>
    props.isToday ? '#e8f0fe' :
        props.isSelected ? '#d3e4fd' :
            props.isOtherMonth ? '#f5f5f5' : 'white'};
  cursor: pointer;
  position: relative;
  
  &:hover {
    background-color: ${props => props.isSelected ? '#d3e4fd' : '#f8f9fa'};
  }
`;

const DayNumber = styled.div`
  font-weight: ${props => props.isToday ? 'bold' : 'normal'};
  color: ${props =>
    props.isOtherMonth ? '#999' :
        props.isToday ? '#2056ad' :
            (props.isHoliday || props.dow === 0) ? '#D14343' :
                props.dow === 6 ? '#2F5FBF' : 'black'};
  margin-bottom: ${clampH(4)};
`;

const Dots = styled.div`
  display: flex;
  gap: 3px;
  margin-top: 4px;
`;

const Dot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: ${props => props.color || '#e8f0fe'};
  display: inline-block;
`;

const EventInputSection = styled.div`
  margin-top: ${clampH(32)};
  padding: ${clampW(24)};
  border: 1px solid #ddd;
  border-radius: 4px;
  width: 100%;
  background-color: #f8f9fa;
`;

const InputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${clampH(16)};
`;

const InputGroup = styled.div`
  display: flex;
  gap: ${clampW(16)};
  align-items: center;
`;

const EventInput = styled.input`
  width: 100%;
  padding: ${clampW(16)};
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1.1rem;

  &:focus {
    outline: none;
    border-color: #2056ad;
    box-shadow: 0 0 0 2px rgba(32, 86, 173, 0.2);
  }
`;

const DateInput = styled.input`
  padding: ${clampW(8)};
  border: 1px solid #ddd;
  border-radius: 4px;
  width: ${clampW(200)};
`;

const AddButton = styled.button`
  padding: ${clampH(8)} ${clampW(24)};
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  white-space: nowrap;
  
  &:hover {
    background-color: #218838;
  }
`;

const EventList = styled.div`
  flex: 0 0 ${clampW(300)};

  @media (max-width: 768px) {
    flex: 1;
  }
`;

const EventListHeader = styled.h3`
  margin-bottom: ${clampH(16)};
  font-size: 1.25rem;
  font-weight: bold;
`;

const EventListContainer = styled.div`
  background-color: #f8f9fa;
  border-radius: 4px;
  padding: ${clampW(16)};
`;

const EventItem = styled.div`
  display: flex;
  align-items: center;
  padding: ${clampH(12)} 0;
  border-bottom: 1px solid #ddd;
  cursor: pointer;
  background-color: ${props => props.isSelected ? '#e9ecef' : 'transparent'};
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background-color: #e9ecef;
  }
`;

const Checkbox = styled.input`
  margin-right: ${clampW(16)};
  cursor: pointer;
`;

const EventContent = styled.span`
  flex: 1;
`;

const DeleteButton = styled.button`
  width: 100%;
  margin-top: ${clampH(16)};
  padding: ${clampW(12)};
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  
  &:hover {
    background-color: #c82333;
  }
  
  &:disabled {
    background-color: #dee2e6;
    cursor: not-allowed;
  }
`;

const EmptyMessage = styled.div`
  text-align: center;
  color: #6c757d;
  padding: ${clampH(16)} 0;
`;

const CalendarPage = () => {

    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    // 날짜별로 미리 묶지 않고 원본 행사(기간 + 주관 기관)를 그대로 들고 있는다.
    // [{id, content, startDate, endDate, organizationId, organization}]
    const [events, setEvents] = useState([]);
    const [newEvent, setNewEvent] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [selectedEvents, setSelectedEvents] = useState([]);
    const [holidaySet, setHolidaySet] = useState(() => new Set());

    const fetchEvents = async () => {
        try {
            // expand=false: 날짜별로 펼치지 않은 원본 일정(시작일/종료일)을 받는다.
            const res = await useApi.get('/events?expand=false');
            setEvents(res.data.data || []);
        } catch (e) {
            console.error('일정 불러오기 실패:', e);
        }
    };

    useEffect(() => {
        const today = new Date();
        setEventDate(formatDate(today));
    }, []);

    useEffect(() => {
        fetchEvents();
    }, []);

    useEffect(() => {
        listHolidays()
            .then((list) => setHolidaySet(new Set(list.map((h) => h.date))))
            .catch((err) => console.error('공휴일 목록 불러오기 실패:', err));
    }, []);

    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    /* 달력 칸의 점은 기간 전체가 아니라 시작일/종료일에만 찍는다 (일당 최대 3개는 렌더링에서 자른다). */
    const dotsByDate = useMemo(() => {
        const map = {};
        events.forEach((event) => {
            const start = event.startDate || event.endDate;
            if (!start) return;
            const end = event.endDate || start;
            const addDot = (value) => {
                const key = value.slice(0, 10);
                (map[key] = map[key] || []).push(event);
            };
            addDot(start);
            if (end !== start) addDot(end);
        });
        return map;
    }, [events]);

    /* 날짜 클릭 시 상세보기(오른쪽 패널)는 점이 없는 중간 날짜라도 그 기간에
       걸쳐 있는 행사를 전부 보여줘야 해서, 시작일~종료일 전체에 걸쳐 등록한다. */
    const byDate = useMemo(() => {
        const map = {};
        events.forEach((event) => {
            const start = event.startDate || event.endDate;
            if (!start) return;
            const end = event.endDate || start;
            const day = new Date(`${start}T00:00:00`);
            const last = new Date(`${end}T00:00:00`);
            for (let i = 0; day <= last && i < 400; i += 1) {
                const key = formatDate(day);
                (map[key] = map[key] || []).push(event);
                day.setDate(day.getDate() + 1);
            }
        });
        return map;
    }, [events]);

    const handlePrevMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1));
    };

    const handleDayClick = (day, month, year) => {
        const newSelectedDate = new Date(year, month, day);
        setSelectedDate(newSelectedDate);
        setEventDate(formatDate(newSelectedDate));
        setSelectedEvents([]);
    };

    const handleAddEvent = async () => {
        if (!newEvent || !eventDate) return;
        try {
            const res = await useAuthApi.post('/events', {
                event_date: eventDate,
                content: newEvent
            });

            const data = res.data;
            if (data.status === 'SUCCESS') {
                await fetchEvents();
                setNewEvent('');
            } else {
                console.error(data.message);
            }
        } catch (e) {
            console.error('일정 추가 실패:', e);
        }
    };

    const handleEventSelect = (index) => {
        setSelectedEvents(prev =>
            prev.includes(index)
                ? prev.filter(i => i !== index)
                : [...prev, index]
        );
    };

    const handleDeleteSelected = async () => {
        const dayEvents = getEventsByDate(selectedDate);
        const toDelete = dayEvents.filter((_, i) => selectedEvents.includes(i));

        try {
            for (const event of toDelete) {
                await useAuthApi.delete('/events', { data: { id: event.id } });
            }
            await fetchEvents();
            setSelectedEvents([]);
        } catch (error) {
            console.error('일정 삭제 실패:', error);
            alert('일정 삭제에 실패했습니다.');
        }
    };

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const today = new Date();

        const days = [];
        const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

        const prevMonthDays = getDaysInMonth(year, month - 1);
        for (let i = firstDay - 1; i >= 0; i--) {
            const day = prevMonthDays - i;
            const date = new Date(year, month - 1, day);
            const dateKey = formatDate(date);
            days.push(
                <DayCell
                    key={`prev-${day}`}
                    isOtherMonth
                    onClick={() => {
                        setCurrentDate(new Date(year, month - 1));
                        handleDayClick(day, month - 1, year);
                    }}
                >
                    <DayNumber isOtherMonth dow={date.getDay()} isHoliday={holidaySet.has(dateKey)}>{day}</DayNumber>
                    {dotsByDate[dateKey]?.length > 0 && (
                        <Dots>
                            {dotsByDate[dateKey].slice(0, 3).map((event, idx) => (
                                <Dot key={idx} color={getOrganizationColor(event.organizationId)} />
                            ))}
                        </Dots>
                    )}
                </DayCell>
            );
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateKey = formatDate(date);
            const isSelectedDay =
                selectedDate.getDate() === day &&
                selectedDate.getMonth() === month &&
                selectedDate.getFullYear() === year;

            const isToday =
                today.getDate() === day &&
                today.getMonth() === month &&
                today.getFullYear() === year;

            days.push(
                <DayCell
                    key={day}
                    isToday={isToday}
                    isSelected={isSelectedDay}
                    onClick={() => handleDayClick(day, month, year)}
                >
                    <DayNumber isToday={isToday} dow={date.getDay()} isHoliday={holidaySet.has(dateKey)}>{day}</DayNumber>
                    {dotsByDate[dateKey]?.length > 0 && (
                        <Dots>
                            {dotsByDate[dateKey].slice(0, 3).map((event, idx) => (
                                <Dot key={idx} color={getOrganizationColor(event.organizationId)} />
                            ))}
                        </Dots>
                    )}
                </DayCell>
            );
        }

        const remainingCells = 42 - days.length;
        for (let day = 1; day <= remainingCells; day++) {
            const date = new Date(year, month + 1, day);
            const dateKey = formatDate(date);
            days.push(
                <DayCell
                    key={`next-${day}`}
                    isOtherMonth
                    onClick={() => {
                        setCurrentDate(new Date(year, month + 1));
                        handleDayClick(day, month + 1, year);
                    }}
                >
                    <DayNumber isOtherMonth dow={date.getDay()} isHoliday={holidaySet.has(dateKey)}>{day}</DayNumber>
                    {dotsByDate[dateKey]?.length > 0 && (
                        <Dots>
                            {dotsByDate[dateKey].slice(0, 3).map((event, idx) => (
                                <Dot key={idx} color={getOrganizationColor(event.organizationId)} />
                            ))}
                        </Dots>
                    )}
                </DayCell>
            );
        }

        return (
            <>
                <WeekDays>
                    {weekDays.map(day => (
                        <WeekDayLabel key={day}>{day}</WeekDayLabel>
                    ))}
                </WeekDays>
                <CalendarGrid>{days}</CalendarGrid>
            </>
        );
    };

    const getEventsByDate = (date) => {
        const dateKey = formatDate(date);
        return byDate[dateKey] || [];
    };

    return (
        <CalendarWrapper>
            <CalendarContainer>
                <CalendarSection>
                    <CalendarHeader>
                        <MonthYearDisplay>
                            {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
                        </MonthYearDisplay>
                        <NavigationButtons>
                            <NavButton onClick={handlePrevMonth}>이전</NavButton>
                            <NavButton onClick={handleNextMonth}>다음</NavButton>
                        </NavigationButtons>
                    </CalendarHeader>
                    {renderCalendar()}
                </CalendarSection>

                <EventList>
                    <EventListHeader>
                        {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 일정
                    </EventListHeader>
                    <EventListContainer>
                        {getEventsByDate(selectedDate).length > 0 ? (
                            <>
                                {getEventsByDate(selectedDate).map((event, index) => (
                                    <EventItem
                                        key={index}
                                        isSelected={selectedEvents.includes(index)}
                                        onClick={() => handleEventSelect(index)}
                                    >
                                        <Checkbox
                                            type="checkbox"
                                            checked={selectedEvents.includes(index)}
                                            onChange={() => handleEventSelect(index)}
                                        />
                                        <EventContent>{event.content}</EventContent>
                                    </EventItem>
                                ))}
                                <DeleteButton
                                    onClick={handleDeleteSelected}
                                    disabled={selectedEvents.length === 0}
                                >
                                    선택한 일정 삭제
                                </DeleteButton>
                            </>
                        ) : (
                            <EmptyMessage>일정이 없습니다.</EmptyMessage>
                        )}
                    </EventListContainer>
                </EventList>
            </CalendarContainer>

            <EventInputSection>
                <h3>일정 추가</h3>
                <InputWrapper>
                    <EventInput
                        type="text"
                        placeholder="일정을 입력하세요"
                        value={newEvent}
                        onChange={(e) => setNewEvent(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddEvent()}
                    />
                    <InputGroup>
                        <DateInput
                            type="date"
                            value={eventDate}
                            onChange={(e) => setEventDate(e.target.value)}
                        />
                        <AddButton onClick={handleAddEvent}>추가</AddButton>
                    </InputGroup>
                </InputWrapper>
            </EventInputSection>
        </CalendarWrapper>
    );
};

export default CalendarPage;
