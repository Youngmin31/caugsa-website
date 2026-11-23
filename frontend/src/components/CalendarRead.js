import React, { useState, useEffect } from 'react';
import { getOrganizationColor, legendFromEvents } from '../utils/organizationColors';
import styled from 'styled-components';
import { useApi } from "../hooks/api/axiosInterceptor";
import { listHolidays } from "../services/holidayService";
import { clampW, clampH } from "../styles/theme";

const CalendarWrapper = styled.div`
  width: 100%;
  max-width: ${clampW(1400)};
  margin: 0 auto;
  padding: ${clampW(32)};
  display: flex;
  flex-direction: column;
`;

const NoticeSection = styled.div`
  background-color: #e8f0fe;
  padding: ${clampW(16)};
  border-radius: 4px;
  margin-bottom: ${clampH(32)};
  text-align: center;
`;

const NoticeText = styled.p`
  color: #1a4786;
  font-weight: 500;
  margin: 0;
`;

const CalendarSection = styled.div`
  width: 100%;
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
  min-height: ${clampH(100)}; /* 더 크게 조정 */
  border: 1px solid #ddd;
  padding: ${clampW(8)};
  background-color: ${props =>
    props.isToday ? '#e8f0fe' :
        props.isSelected ? '#d3e4fd' :
            props.isOtherMonth ? '#f5f5f5' : 'white'
};
  cursor: pointer;
  position: relative;

  &:hover {
    background-color: ${props => props.isSelected ? '#d3e4fd' : '#f8f9fa'};
  }

  @media (min-width: 1200px) {
    min-height: ${clampH(120)}; /* 큰 화면에서 더 크게 */
  }
`;

const DayNumber = styled.div`
  font-weight: ${props => props.isToday ? 'bold' : 'normal'};
  color: ${props =>
    props.isOtherMonth ? '#999' :
        props.isToday ? '#2056ad' :
            (props.isHoliday || props.dow === 0) ? '#D14343' :
                props.dow === 6 ? '#2F5FBF' : 'black'
};
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

const EventListSection = styled.div`
  width: 100%;
  margin-top: ${clampH(32)};
  border: 1px solid #ddd;
  border-radius: 4px;
`;

const EventListHeader = styled.div`
  background-color: #2056ad;
  color: white;
  padding: ${clampW(16)};
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  font-size: 1.25rem;
  font-weight: bold;
`;

const EventListContainer = styled.div`
  background-color: #f8f9fa;
  padding: ${clampW(16)};
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;
  max-height: ${clampH(300)};
  overflow-y: auto;
`;

const EventList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${clampW(300)}, 1fr));
  gap: ${clampW(16)};
`;

const EventItem = styled.div`
  display: flex;
  align-items: center;
  padding: ${clampH(12)} ${clampW(16)};
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
`;

const EventContent = styled.span`
  flex: 1;
`;

const EmptyMessage = styled.div`
  text-align: center;
  color: #6c757d;
  padding: ${clampH(32)} 0;
`;

const OrgTag = styled.span`
  margin-left: ${clampW(8)};
  padding: 2px ${clampW(8)};
  border-radius: 10px;
  background-color: #eef1f6;
  font-size: ${clampW(12, 0.15)};
  color: #55617a;
  vertical-align: middle;
`;

const Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${clampH(10)} ${clampW(16)};
  margin-top: ${clampH(14)};
  padding: ${clampH(12)} ${clampW(14)};
  border-top: 1px solid #e8eaf0;
  font-size: ${clampW(13, 0.15)};
  color: #555;
`;

const LegendItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${clampW(6)};
`;

const LegendSwatch = styled.i`
  width: ${clampW(13, 0.15)};
  height: ${clampW(13, 0.15)};
  border-radius: 3px;
  background-color: ${props => props.color};
  display: inline-block;
`;


const CalendarReadPage = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [events, setEvents] = useState({});
    const [legend, setLegend] = useState([]);
    const [holidaySet, setHolidaySet] = useState(() => new Set());

    useEffect(() => {
        listHolidays()
            .then((list) => setHolidaySet(new Set(list.map((h) => h.date))))
            .catch((err) => console.error('공휴일 목록 불러오기 오류:', err));
    }, []);

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                // expand=false: 날짜별로 펼치지 않은 원본 일정(시작일/종료일)을 받는다.
                // 여러 날에 걸친 일정을 매일 표시하면 겹치는 날이 많을 때 지저분해져서,
                // 시작일과 종료일 두 칸에만 표시한다.
                const response = await useApi.get('/events?expand=false');
                const serverEvents = response.data.data;

                // 색은 이름이 아니라 주관 기관(organizationId)으로 정하므로
                // 일정마다 기관 정보를 함께 들고 다닌다.
                const eventMap = {};
                const addTo = (date, entry) => {
                    if (!date) return;
                    (eventMap[date] = eventMap[date] || []).push(entry);
                };
                serverEvents.forEach(item => {
                    const start = item.startDate || item.endDate;
                    const end = item.endDate || item.startDate;
                    if (!start) return;
                    const entry = {
                        name: item.content,
                        organizationId: item.organizationId ?? null,
                        organization: item.organization ?? null,
                    };
                    addTo(start, entry);
                    if (end && end !== start) addTo(end, entry);
                });

                setEvents(eventMap);
                setLegend(legendFromEvents(serverEvents));
            } catch (error) {
                console.error('이벤트 불러오기 실패:', error);
            }
        };

        fetchEvents();
    }, []);


    const formatDate = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const handlePrevMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1));
    };

    const handleDayClick = (day, month, year) => {
        const newSelectedDate = new Date(year, month, day);
        setSelectedDate(newSelectedDate);
    };

    const getDaysInMonth = (year, month) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year, month) => {
        return new Date(year, month, 1).getDay();
    };

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
                <DayCell key={`prev-${day}`} isOtherMonth onClick={() => {
                    setCurrentDate(new Date(year, month - 1));
                    handleDayClick(day, month - 1, year);
                }}>
                    <DayNumber isOtherMonth dow={date.getDay()} isHoliday={holidaySet.has(dateKey)}>{day}</DayNumber>
                    {events[dateKey]?.length > 0 && (
                        <Dots>
                            {events[dateKey].slice(0, 3).map((event, idx) => (
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
            const isToday = today.toDateString() === date.toDateString();
            const isSelected = selectedDate.toDateString() === date.toDateString();
            days.push(
                <DayCell key={day} isToday={isToday} isSelected={isSelected} onClick={() => handleDayClick(day, month, year)}>
                    <DayNumber isToday={isToday} dow={date.getDay()} isHoliday={holidaySet.has(dateKey)}>{day}</DayNumber>
                    {events[dateKey]?.length > 0 && (
                        <Dots>
                            {events[dateKey].slice(0, 3).map((event, idx) => (
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
                <DayCell key={`next-${day}`} isOtherMonth onClick={() => {
                    setCurrentDate(new Date(year, month + 1));
                    handleDayClick(day, month + 1, year);
                }}>
                    <DayNumber isOtherMonth dow={date.getDay()} isHoliday={holidaySet.has(dateKey)}>{day}</DayNumber>
                    {events[dateKey]?.length > 0 && (
                        <Dots>
                            {events[dateKey].slice(0, 3).map((event, idx) => (
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

    const selectedDateEvents = events[formatDate(selectedDate)] || [];

    return (
        <CalendarWrapper>
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

            <EventListSection>
                <EventListHeader>
                    {selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 일정
                </EventListHeader>
                <EventListContainer>
                    {selectedDateEvents.length > 0 ? (
                        <EventList>
                            {selectedDateEvents.map((event, idx) => (
                                <EventItem key={idx} style={{ borderLeft: `4px solid ${getOrganizationColor(event.organizationId)}` }}>
                                    <EventContent>
                                        {event.name}
                                        {event.organization && <OrgTag>{event.organization}</OrgTag>}
                                    </EventContent>
                                </EventItem>
                            ))}
                        </EventList>
                    ) : (
                        <EmptyMessage>일정이 없습니다.</EmptyMessage>
                    )}
                    {legend.length > 0 && (
                        <Legend>
                            {legend.map(item => (
                                <LegendItem key={item.name}>
                                    <LegendSwatch color={item.color} />
                                    {item.name}
                                </LegendItem>
                            ))}
                        </Legend>
                    )}
                </EventListContainer>
            </EventListSection>
        </CalendarWrapper>
    );
};

export default CalendarReadPage;