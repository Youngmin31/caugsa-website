/**
 * HomeCalendar
 * ============
 * 메인 화면 "연간 일정" 패널. 시안(figma 화면/중대중심 최종) 기준으로
 * 왼쪽은 달력, 오른쪽은 선택한 날짜의 일정 목록이다.
 *
 * /api/events?expand=false 로 원본 행사(기간 + 주관 기관)를 받아
 *   - 달력에는 날짜별 점으로 (기관 색)
 *   - 오른쪽에는 기관별로 묶어서 기간과 함께
 * 보여준다. 서브 페이지의 CalendarRead 와는 화면이 달라 따로 둔다.
 *
 * 일정 구분은 화면에서 "총학생회 / 학사일정" 두 갈래로만 보여 주지만,
 * 저장은 기관 단위(organization_id)로 한다. utils/organizations.js 참고.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";

import { useApi, useAuthApi } from "../../hooks/api/axiosInterceptor";
import { isAdminUser, watchAuthChange } from "../../utils/auth";
import { ORGANIZATION_OPTIONS, categoryColor, categoryOf } from "../../utils/organizations";
import { listHolidays } from "../../services/holidayService";
import { colors, font, media, radius, homePx } from "../../styles/theme";

/**
 * 왼쪽 달력 / 오른쪽 일정 목록.
 *
 * 머리글 두 개를 같은 행(row 1)에 두어 행 높이가 큰 쪽(연도+월 두 줄인 왼쪽)에
 * 맞춰지게 한다. 그래야 양쪽 밑줄이 같은 높이에 그어진다.
 * DOM 순서는 [달력머리 / 달력본문 / 일정머리 / 일정본문] 이라 좁은 화면에서
 * 배치를 풀면 그대로 자연스럽게 쌓인다.
 */
const Layout = styled.div`
    display: grid;
    grid-template-columns: 662fr 468fr;
    grid-template-rows: auto 1fr;
    column-gap: ${homePx(60)};

    ${media.tablet} {
        grid-template-columns: 1fr;
        grid-template-rows: none;
        row-gap: ${homePx(34)};

        /* 한 줄짜리 배치에서는 위치 지정을 풀어 DOM 순서대로 쌓는다.
           각 항목이 자기 클래스로 grid-column 을 잡고 있어 && 로 우선순위를 올린다. */
        && > * {
            grid-column: auto;
            grid-row: auto;
        }
    }
`;

const CalendarBody = styled.div`
    grid-column: 1;
    grid-row: 2;
`;

/**
 * 일정이 많아지면 오른쪽이 달력보다 훨씬 길어져 버린다. 왼쪽 달력의 실측 높이를
 * (아래 HomeCalendar 에서 ResizeObserver 로 재서) max-height 로 걸어 두고, 그 안에서만
 * 스크롤되게 한다. 높이를 아직 재지 못한 첫 렌더에서는 제한을 걸지 않는다.
 */
const DetailBody = styled.div`
    grid-column: 2;
    grid-row: 2;

    ${(props) =>
        props.$maxHeight
            ? `
        max-height: ${props.$maxHeight}px;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding-right: ${homePx(8)};
    `
            : ""}

    ${media.tablet} {
        max-height: none;
        overflow-y: visible;
        padding-right: 0;
    }
`;

const Head = styled.div`
    grid-column: 1;
    grid-row: 1;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: ${homePx(16)};
    padding-bottom: ${homePx(14)};
    border-bottom: 2px solid ${colors.navy};
`;

const MonthLabel = styled.div`
    font-family: ${font.family};
    color: ${colors.navy};

    small {
        display: block;
        font-size: ${homePx(20)};
        font-weight: ${font.weight.bold};
        line-height: 1.2;
    }

    strong {
        display: block;
        font-size: ${homePx(46)};
        font-weight: ${font.weight.bold};
        line-height: 1.1;
        letter-spacing: -0.01em;
    }

    ${media.mobile} {
        small {
            font-size: ${homePx(14)};
        }

        strong {
            font-size: ${homePx(30)};
        }
    }
`;

const NavButtons = styled.div`
    display: flex;
    align-items: center;
    gap: ${homePx(18)};
    padding-bottom: ${homePx(6)};
`;

const NavButton = styled.button`
    width: ${homePx(28)};
    height: ${homePx(28)};
    padding: 0;
    border: none;
    background: none;
    color: ${colors.navy};
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;

    &:hover {
        opacity: 0.6;
    }
`;

const WeekRow = styled.div`
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    margin-top: ${homePx(22)};
`;

const WeekLabel = styled.span`
    text-align: center;
    font-family: ${font.family};
    font-size: ${homePx(20)};
    font-weight: ${font.weight.bold};
    color: ${colors.navy};

    ${media.mobile} {
        font-size: ${homePx(13)};
    }
`;

const DayGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    row-gap: ${homePx(28)};
    margin-top: ${homePx(18)};
`;

const DayCell = styled.button`
    position: relative;
    height: ${homePx(78)};
    width: ${homePx(56)};
    justify-self: center;
    padding: 0;
    border: none;
    background: ${(props) => (props.$selected ? colors.navy : "transparent")};
    border-radius: ${radius.md};
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${homePx(6)};
    font-family: ${font.family};
    font-size: ${homePx(20)};
    font-weight: ${font.weight.bold};
    color: ${(props) => {
        if (props.$selected) return colors.white;
        if (props.$holiday || props.$weekday === 0) return "#D14343"; // 공휴일·일요일
        if (props.$weekday === 6) return "#2F5FBF"; // 토요일
        return colors.navy;
    }};

    &:hover {
        background: ${(props) => (props.$selected ? colors.navy : "#E8EDF9")};
    }

    ${media.mobile} {
        height: ${homePx(54)};
        width: ${homePx(36)};
        font-size: ${homePx(13)};
    }
`;

/* 앞달 자리를 비워 두는 칸. 클릭도 hover 도 없다. */
const BlankCell = styled.span`
    height: ${homePx(78)};

    ${media.mobile} {
        height: ${homePx(54)};
    }
`;

const Dots = styled.span`
    display: flex;
    align-items: center;
    gap: ${homePx(4)};
    height: ${homePx(7)};
`;

const Dot = styled.i`
    width: ${homePx(7)};
    height: ${homePx(7)};
    border-radius: 50%;
    background: ${(props) => props.$color};
    display: block;
`;

/**
 * 왼쪽 머리글과 같은 행이라 높이가 늘어난다.
 * 늘어난 만큼은 위를 비우고 내용은 밑줄 바로 위에 붙여, 양쪽 선을 맞춘다.
 */
const DetailHead = styled.div`
    grid-column: 2;
    grid-row: 1;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding-bottom: ${homePx(14)};
    border-bottom: 2px solid ${colors.navy};

    span {
        display: inline-flex;
        align-items: center;
        gap: ${homePx(12)};
        font-family: ${font.family};
        font-size: ${homePx(24)};
        font-weight: ${font.weight.bold};
        color: ${colors.navy};
        line-height: 1.2;
    }

    ${media.mobile} {
        span {
            font-size: ${homePx(17)};
        }
    }
`;

const GroupLabel = styled.p`
    display: flex;
    align-items: center;
    gap: ${homePx(8)};
    margin: ${homePx(22)} 0 ${homePx(10)};
    font-family: ${font.family};
    font-size: ${homePx(15)};
    font-weight: ${font.weight.bold};
    color: ${colors.navy};

    i {
        width: ${homePx(8)};
        height: ${homePx(8)};
        border-radius: 50%;
        background: ${(props) => props.$color};
        display: inline-block;
    }
`;

const EventCard = styled.div`
    position: relative;
    background: ${colors.white};
    border-radius: ${radius.md};
    padding: ${homePx(14)} ${homePx(18)} ${homePx(14)} ${homePx(22)};
    margin-bottom: ${homePx(10)};
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${homePx(12)};

    &::before {
        content: "";
        position: absolute;
        left: ${homePx(10)};
        top: ${homePx(14)};
        bottom: ${homePx(14)};
        width: 3px;
        border-radius: 2px;
        background: ${(props) => props.$color};
    }

    strong {
        display: block;
        font-family: ${font.family};
        font-size: ${homePx(17)};
        font-weight: ${font.weight.bold};
        color: ${colors.navy};
        line-height: 1.4;
    }

    /* 날짜 줄. 오른쪽 아이콘 묶음(span)까지 걸리지 않도록 em 으로 좁힌다. */
    em {
        display: block;
        margin-top: ${homePx(4)};
        font-family: ${font.family};
        font-style: normal;
        font-size: ${homePx(15)};
        color: ${colors.textMuted};
    }
`;

/* =========================================================================
 * 관리자 전용 (로그인 role 이 admin 일 때만 렌더된다)
 * ====================================================================== */

const IconButton = styled.button`
    flex: 0 0 auto;
    width: ${homePx(28)};
    height: ${homePx(28)};
    padding: 0;
    border: none;
    background: none;
    color: ${colors.textLight};
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: color 0.15s ease, background 0.15s ease;

    &:hover {
        color: ${(props) => (props.$danger ? "#C62828" : colors.navy)};
        background: rgba(18, 24, 80, 0.06);
    }

    &:disabled {
        opacity: 0.4;
        cursor: default;
    }
`;

const CardActions = styled.span`
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: ${homePx(4)};
`;

/** 그룹 끝의 "+" 줄. 누르면 그 그룹에 새 일정을 추가하는 폼이 열린다. */
const AddRow = styled.button`
    width: 100%;
    margin-bottom: ${homePx(10)};
    padding: ${homePx(11)} 0;
    border: 1px dashed rgba(18, 24, 80, 0.18);
    border-radius: ${radius.md};
    background: ${colors.white};
    color: ${colors.textMuted};
    font-family: ${font.family};
    font-size: ${homePx(18)};
    line-height: 1;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;

    &:hover {
        border-color: ${colors.navy};
        color: ${colors.navy};
    }
`;

const EditForm = styled.form`
    background: ${colors.white};
    border: 1px solid rgba(18, 24, 80, 0.14);
    border-radius: ${radius.md};
    padding: ${homePx(14)} ${homePx(16)};
    margin-bottom: ${homePx(10)};
    display: flex;
    flex-direction: column;
    gap: ${homePx(8)};

    input,
    select {
        width: 100%;
        padding: ${homePx(8)} ${homePx(10)};
        border: 1px solid ${colors.border};
        border-radius: 4px;
        font-family: ${font.family};
        font-size: ${homePx(15)};
        color: ${colors.navy};
        background: ${colors.white};
    }

    input:focus,
    select:focus {
        outline: 2px solid rgba(18, 24, 80, 0.35);
        outline-offset: 1px;
    }
`;

const DateRow = styled.div`
    display: flex;
    align-items: center;
    gap: ${homePx(8)};

    span {
        flex: 0 0 auto;
        font-family: ${font.family};
        font-size: ${homePx(14)};
        color: ${colors.textMuted};
    }
`;

const FormButtons = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: ${homePx(8)};
    margin-top: ${homePx(2)};

    button {
        padding: ${homePx(8)} ${homePx(16)};
        border-radius: 4px;
        font-family: ${font.family};
        font-size: ${homePx(14)};
        font-weight: ${font.weight.semibold};
        cursor: pointer;
        border: 1px solid ${colors.border};
        background: ${colors.white};
        color: ${colors.textMuted};
    }

    button[type="submit"] {
        border-color: ${colors.navy};
        background: ${colors.navy};
        color: ${colors.white};
    }

    button:disabled {
        opacity: 0.5;
        cursor: default;
    }
`;

const EmptyText = styled.p`
    margin: ${homePx(26)} 0 0;
    font-family: ${font.family};
    font-size: ${homePx(15)};
    color: ${colors.textLight};
`;

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = [
    "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
    "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

const toKey = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate()
    ).padStart(2, "0")}`;

/** "2026-08-12" -> "08.12." (시안 표기) */
const shortDate = (value) => (value ? `${value.slice(5, 7)}.${value.slice(8, 10)}.` : "");

/** "2026-08-12" -> "2026.08.12." */
const longDate = (value) =>
    value ? `${value.slice(0, 4)}.${value.slice(5, 7)}.${value.slice(8, 10)}.` : "";

const ChevronLeft = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const ChevronRight = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const CalendarIcon = () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.4" y="5" width="17.2" height="15.2" rx="2.4" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3.4 9.6h17.2M8 3.4v3.2M16 3.4v3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
);

const PencilIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
);

const RemoveIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.4" stroke="currentColor" strokeWidth="1.6" />
        <path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
);

const DownloadIcon = () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3.6v10.2m0 0l-3.6-3.6M12 13.8l3.6-3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4.6 16.4v2.2a1.8 1.8 0 0 0 1.8 1.8h11.2a1.8 1.8 0 0 0 1.8-1.8v-2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
);

/** 일정 목록을 캘린더 앱이 읽을 수 있는 .ics 로 만든다. */
const buildIcs = (events) => {
    const stamp = `${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
    const compact = (value) => String(value || "").slice(0, 10).replace(/-/g, "");
    // 종일 일정의 DTEND 는 끝난 다음 날을 가리킨다
    const nextDay = (value) => {
        const d = new Date(`${value}T00:00:00`);
        d.setDate(d.getDate() + 1);
        return compact(toKey(d));
    };
    const escape = (text) => String(text || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");

    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//중앙대학교 총학생회//중대중심//KO",
        "CALSCALE:GREGORIAN",
    ];
    events.forEach((event) => {
        const start = event.startDate || event.endDate;
        if (!start) return;
        const end = event.endDate || start;
        lines.push(
            "BEGIN:VEVENT",
            `UID:cau-event-${event.id}@caugsa`,
            `DTSTAMP:${stamp}`,
            `DTSTART;VALUE=DATE:${compact(start)}`,
            `DTEND;VALUE=DATE:${nextDay(end)}`,
            `SUMMARY:${escape(event.content)}`
        );
        if (event.organization) lines.push(`CATEGORIES:${escape(event.organization)}`);
        lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
};

const HomeCalendar = () => {
    const today = useMemo(() => new Date(), []);
    const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
    const [selected, setSelected] = useState(today);
    const [events, setEvents] = useState([]);
    const [holidays, setHolidays] = useState([]);

    // 관리자일 때만 편집 UI 를 붙인다. 서버도 @admin_required 로 다시 검사한다.
    const [isAdmin, setIsAdmin] = useState(isAdminUser);
    // form = null | { mode: "add" | "edit", id?, groupKey?, content, startDate, endDate, organizationId }
    const [form, setForm] = useState(null);
    const [busy, setBusy] = useState(false);

    // 오른쪽 일정 목록의 최대 높이 = 왼쪽 달력의 실측 높이. 달력은 주 수(5주/6주)와
    // 화면 폭(vw 기반 치수)에 따라 높이가 바뀌므로 ResizeObserver 로 계속 재본다.
    const calendarBodyRef = useRef(null);
    const [calendarHeight, setCalendarHeight] = useState(0);

    useEffect(() => {
        const el = calendarBodyRef.current;
        if (!el || typeof ResizeObserver === "undefined") return undefined;
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) setCalendarHeight(entry.contentRect.height);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    useEffect(() => watchAuthChange(() => setIsAdmin(isAdminUser())), []);

    const loadEvents = useCallback(async () => {
        try {
            // expand=false 면 날짜별로 펼치지 않은 원본 행사가 온다
            const { data } = await useApi.get("/events?expand=false");
            setEvents(data.data || []);
        } catch (err) {
            console.error("일정 불러오기 오류:", err);
        }
    }, []);

    useEffect(() => {
        loadEvents();
    }, [loadEvents]);

    useEffect(() => {
        listHolidays().then(setHolidays).catch((err) => console.error("공휴일 목록 불러오기 오류:", err));
    }, []);

    const holidaySet = useMemo(() => new Set(holidays.map((h) => h.date)), [holidays]);

    /** 날짜(YYYY-MM-DD) -> 그날 걸쳐 있는 행사 목록. 날짜를 눌렀을 때 오른쪽 상세에 쓴다. */
    const byDate = useMemo(() => {
        const map = {};
        events.forEach((event) => {
            const start = event.startDate || event.endDate;
            if (!start) return;
            const end = event.endDate || start;
            const day = new Date(`${start}T00:00:00`);
            const last = new Date(`${end}T00:00:00`);
            // 잘못된 데이터로 무한 루프에 빠지지 않도록 400일에서 끊는다
            for (let i = 0; day <= last && i < 400; i += 1) {
                const key = toKey(day);
                (map[key] = map[key] || []).push(event);
                day.setDate(day.getDate() + 1);
            }
        });
        return map;
    }, [events]);

    /* 달력 칸의 점은 기간 전체가 아니라 시작일/종료일에만 찍는다. 9/8~9/11 짜리
       일정이면 9/8, 9/11 에 점이 보이고, 그 사이(9/9~9/10)는 점 없이 눌러야(byDate) 나온다. */
    const dotsByDate = useMemo(() => {
        const map = {};
        events.forEach((event) => {
            const start = event.startDate || event.endDate;
            if (!start) return;
            const end = event.endDate || start;
            const addDot = (value) => {
                const key = toKey(new Date(`${value}T00:00:00`));
                (map[key] = map[key] || []).push(event);
            };
            addDot(start);
            if (end !== start) addDot(end);
        });
        return map;
    }, [events]);

    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);

    const selectedKey = toKey(selected);
    const selectedEvents = byDate[selectedKey] || [];

    // 오른쪽 목록은 "총학생회 / 학사일정" 두 갈래로 묶는다.
    // 어느 기관이 주관인지는 수정 폼에서 확인/변경한다.
    const groups = [];
    selectedEvents.forEach((event) => {
        const name = categoryOf(event.organizationId);
        let group = groups.find((item) => item.name === name);
        if (!group) {
            group = {
                name,
                color: categoryColor(event.organizationId),
                // 그 갈래의 "+" 로 추가할 때 기본으로 채울 기관
                organizationId: event.organizationId === undefined ? null : event.organizationId,
                items: [],
            };
            groups.push(group);
        }
        group.items.push(event);
    });

    const moveMonth = (delta) => setCursor(new Date(year, month + delta, 1));

    const startAdd = (group) =>
        setForm({
            mode: "add",
            groupKey: group ? group.name : "",
            content: "",
            startDate: selectedKey,
            endDate: selectedKey,
            organizationId:
                group && group.organizationId !== null ? String(group.organizationId) : "",
        });

    const startEdit = (event) =>
        setForm({
            mode: "edit",
            id: event.id,
            content: event.content || "",
            startDate: (event.startDate || event.endDate || selectedKey).slice(0, 10),
            endDate: (event.endDate || event.startDate || selectedKey).slice(0, 10),
            organizationId:
                event.organizationId === null || event.organizationId === undefined
                    ? ""
                    : String(event.organizationId),
        });

    const submitForm = async (e) => {
        e.preventDefault();
        const content = form.content.trim();
        if (!content) {
            alert("일정 이름을 입력해 주세요.");
            return;
        }
        if (form.endDate < form.startDate) {
            alert("종료일이 시작일보다 앞설 수 없습니다.");
            return;
        }

        const payload = {
            content,
            event_date: form.startDate,
            end_date: form.endDate || form.startDate,
            organization_id: form.organizationId === "" ? null : Number(form.organizationId),
        };

        setBusy(true);
        try {
            if (form.mode === "edit") {
                await useAuthApi.put(`/events/${form.id}`, payload);
            } else {
                await useAuthApi.post("/events", payload);
            }
            await loadEvents();
            setForm(null);
        } catch (err) {
            alert((err.response && err.response.data && err.response.data.message) || "일정을 저장하지 못했습니다.");
        } finally {
            setBusy(false);
        }
    };

    const removeEvent = async (event) => {
        if (!window.confirm(`"${event.content}" 일정을 삭제할까요?`)) return;
        setBusy(true);
        try {
            await useAuthApi.delete("/events", { data: { id: event.id } });
            await loadEvents();
            if (form && form.mode === "edit" && form.id === event.id) setForm(null);
        } catch (err) {
            alert((err.response && err.response.data && err.response.data.message) || "일정을 삭제하지 못했습니다.");
        } finally {
            setBusy(false);
        }
    };

    const downloadIcs = () => {
        const blob = new Blob([buildIcs(events)], { type: "text/calendar;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `중대중심-연간일정-${year}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const renderForm = () => (
        <EditForm onSubmit={submitForm}>
            <input
                type="text"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="일정 이름"
                maxLength={255}
                autoFocus
            />
            <DateRow>
                <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    aria-label="시작일"
                />
                <span>~</span>
                <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    aria-label="종료일"
                />
            </DateRow>
            {/* 화면에는 두 갈래로 보이지만 저장은 기관 단위로 한다 (13기관 + 학사일정) */}
            <select
                value={form.organizationId}
                onChange={(e) => setForm({ ...form, organizationId: e.target.value })}
                aria-label="주관"
            >
                {ORGANIZATION_OPTIONS.map((option) => (
                    <option key={option.value || "academic"} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            <FormButtons>
                <button type="button" onClick={() => setForm(null)} disabled={busy}>
                    취소
                </button>
                <button type="submit" disabled={busy}>
                    {busy ? "저장 중…" : "저장"}
                </button>
            </FormButtons>
        </EditForm>
    );

    const isEditing = (event) => form && form.mode === "edit" && form.id === event.id;
    const isAddingTo = (groupName) => form && form.mode === "add" && form.groupKey === groupName;

    return (
        <Layout>
            <Head>
                <MonthLabel>
                    <small>{year}</small>
                    <strong>{MONTHS[month]}</strong>
                </MonthLabel>
                <NavButtons>
                    {isAdmin && (
                        <NavButton
                            type="button"
                            onClick={downloadIcs}
                            aria-label="일정 파일(.ics) 내려받기"
                            title="일정 내려받기"
                        >
                            <DownloadIcon />
                        </NavButton>
                    )}
                    <NavButton type="button" onClick={() => moveMonth(-1)} aria-label="이전 달">
                        <ChevronLeft />
                    </NavButton>
                    <NavButton type="button" onClick={() => moveMonth(1)} aria-label="다음 달">
                        <ChevronRight />
                    </NavButton>
                </NavButtons>
            </Head>

            <CalendarBody ref={calendarBodyRef}>
                <WeekRow>
                    {WEEKDAYS.map((label) => (
                        <WeekLabel key={label}>{label}</WeekLabel>
                    ))}
                </WeekRow>

                <DayGrid>
                    {cells.map((day, index) => {
                        if (day === null) {
                            return <BlankCell key={`blank-${index}`} />;
                        }
                        const key = toKey(new Date(year, month, day));
                        const dayDots = dotsByDate[key] || [];
                        return (
                            <DayCell
                                key={key}
                                type="button"
                                $selected={key === selectedKey}
                                $weekday={index % 7}
                                $holiday={holidaySet.has(key)}
                                onClick={() => {
                                    setSelected(new Date(year, month, day));
                                    setForm(null);
                                }}
                            >
                                {day}
                                <Dots>
                                    {dayDots.slice(0, 3).map((event, dotIndex) => (
                                        <Dot
                                            key={`${event.id}-${dotIndex}`}
                                            $color={categoryColor(event.organizationId)}
                                        />
                                    ))}
                                </Dots>
                            </DayCell>
                        );
                    })}
                </DayGrid>
            </CalendarBody>

            <DetailHead>
                <span>
                    <CalendarIcon />
                    {longDate(selectedKey)}
                </span>
            </DetailHead>

            <DetailBody $maxHeight={calendarHeight}>

                {groups.length === 0 && !isAddingTo("") && <EmptyText>등록된 일정이 없습니다.</EmptyText>}

                {groups.map((group) => (
                    <div key={group.name}>
                        <GroupLabel $color={group.color}>
                            <i />
                            {group.name}
                        </GroupLabel>

                        {group.items.map((event, index) =>
                            isEditing(event) ? (
                                <div key={`${event.id}-${index}`}>{renderForm()}</div>
                            ) : (
                                <EventCard key={`${event.id}-${index}`} $color={group.color}>
                                    <div>
                                        <strong>{event.content}</strong>
                                        <em>
                                            {(event.startDate || event.endDate) === (event.endDate || event.startDate)
                                                ? shortDate(event.startDate || event.endDate)
                                                : `${shortDate(event.startDate)} – ${shortDate(event.endDate)}`}
                                        </em>
                                    </div>
                                    {isAdmin && (
                                        <CardActions>
                                            <IconButton
                                                type="button"
                                                onClick={() => startEdit(event)}
                                                aria-label={`${event.content} 수정`}
                                                title="수정"
                                            >
                                                <PencilIcon />
                                            </IconButton>
                                            <IconButton
                                                type="button"
                                                $danger
                                                onClick={() => removeEvent(event)}
                                                disabled={busy}
                                                aria-label={`${event.content} 삭제`}
                                                title="삭제"
                                            >
                                                <RemoveIcon />
                                            </IconButton>
                                        </CardActions>
                                    )}
                                </EventCard>
                            )
                        )}

                        {isAdmin &&
                            (isAddingTo(group.name) ? (
                                renderForm()
                            ) : (
                                <AddRow
                                    type="button"
                                    onClick={() => startAdd(group)}
                                    aria-label={`${group.name}에 일정 추가`}
                                >
                                    +
                                </AddRow>
                            ))}
                    </div>
                ))}

                {/* 일정이 하나도 없는 날에도 추가할 수 있어야 한다 */}
                {isAdmin &&
                    groups.length === 0 &&
                    (isAddingTo("") ? (
                        renderForm()
                    ) : (
                        <AddRow type="button" onClick={() => startAdd(null)} aria-label="일정 추가">
                            +
                        </AddRow>
                    ))}
            </DetailBody>
        </Layout>
    );
};

export default HomeCalendar;
