import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import styled from "styled-components";
import useApi, {useApi_file} from "../../hooks/api/axiosInterceptor";
import CalendarReadPage from "../../components/CalendarRead";

const Wrapper = styled.div`
  height: 100%;
  width: 100%;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;

`;





const CalendarNews = () => {

    return (
        <Wrapper>
            <CalendarReadPage />
        </Wrapper>
    );
};

export default CalendarNews;
