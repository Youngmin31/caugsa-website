/**
 * HolidayManager
 * ==============
 * 공휴일 날짜 등록/삭제 (관리자 일정수정 화면에서 쓴다).
 * 등록된 날짜는 캘린더(HomeCalendar / CalendarRead / Calendar) 날짜 숫자를
 * 빨간색으로 칠하는 데 쓰인다.
 */

import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { clampW, clampH } from '../styles/theme';
import { addHoliday, deleteHoliday, listHolidays } from '../services/holidayService';

const Wrapper = styled.div`
  width: 100%;
  max-width: ${clampW(1400)};
  margin: ${clampH(32)} auto 0;
  padding: ${clampW(32)};
`;

const Title = styled.h3`
  font-size: 1.25rem;
  font-weight: bold;
  margin: 0 0 ${clampH(16)};
`;

const Form = styled.form`
  display: flex;
  flex-wrap: wrap;
  gap: ${clampW(12)};
  align-items: center;
  margin-bottom: ${clampH(16)};
`;

const DateInput = styled.input`
  padding: ${clampW(8)};
  border: 1px solid #ddd;
  border-radius: 4px;
`;

const NameInput = styled.input`
  flex: 1;
  min-width: ${clampW(160)};
  padding: ${clampW(8)};
  border: 1px solid #ddd;
  border-radius: 4px;
`;

const AddButton = styled.button`
  padding: ${clampH(8)} ${clampW(20)};
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background-color: #218838;
  }

  &:disabled {
    background-color: #dee2e6;
    cursor: not-allowed;
  }
`;

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${clampH(6)};
`;

const Item = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${clampH(8)} ${clampW(12)};
  background-color: #f8f9fa;
  border-radius: 4px;
`;

const DateText = styled.span`
  color: #D14343;
  font-weight: bold;
  margin-right: ${clampW(10)};
`;

const RemoveButton = styled.button`
  padding: 4px ${clampW(10)};
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;

  &:hover {
    background-color: #c82333;
  }
`;

const Empty = styled.p`
  color: #6c757d;
  padding: ${clampH(12)} 0;
`;

const HolidayManager = () => {
    const [holidays, setHolidays] = useState([]);
    const [date, setDate] = useState('');
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);

    const load = async () => {
        try {
            setHolidays(await listHolidays());
        } catch (err) {
            console.error('공휴일 목록 불러오기 실패:', err);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!date || !name.trim()) return;
        setBusy(true);
        try {
            setHolidays(await addHoliday(date, name.trim()));
            setDate('');
            setName('');
        } catch (err) {
            alert((err.response && err.response.data && err.response.data.message) || '공휴일을 추가하지 못했습니다.');
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async (targetDate) => {
        if (!window.confirm(`${targetDate} 공휴일을 삭제할까요?`)) return;
        try {
            setHolidays(await deleteHoliday(targetDate));
        } catch (err) {
            alert((err.response && err.response.data && err.response.data.message) || '공휴일을 지우지 못했습니다.');
        }
    };

    return (
        <Wrapper>
            <Title>공휴일 관리</Title>
            <Form onSubmit={handleAdd}>
                <DateInput
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    aria-label="공휴일 날짜"
                />
                <NameInput
                    type="text"
                    placeholder="공휴일 이름 (예: 개천절)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={60}
                />
                <AddButton type="submit" disabled={busy}>
                    {busy ? '추가 중…' : '추가'}
                </AddButton>
            </Form>

            {holidays.length === 0 ? (
                <Empty>등록된 공휴일이 없습니다.</Empty>
            ) : (
                <List>
                    {holidays.map((holiday) => (
                        <Item key={holiday.date}>
                            <span>
                                <DateText>{holiday.date}</DateText>
                                {holiday.name}
                            </span>
                            <RemoveButton type="button" onClick={() => handleDelete(holiday.date)}>
                                삭제
                            </RemoveButton>
                        </Item>
                    ))}
                </List>
            )}
        </Wrapper>
    );
};

export default HolidayManager;
