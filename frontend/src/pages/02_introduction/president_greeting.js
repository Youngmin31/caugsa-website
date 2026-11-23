/**
 * 총학생회 회장단 인사말
 * ========================
 * 이미지로 만들어진 페이지다. 관리자가 콘텐츠 관리(/admin/content)에서 올린
 * 이미지를 그대로 그린다. 이 페이지는 게시글과 무관하다.
 */

import React from "react";

import PageHeader from "../../components/board/PageHeader";
import SectionImages from "../../components/info/SectionImages";

const PresidentGreeting = () => (
    <>
        <PageHeader title="총학생회 회장단 인사말" />
        <SectionImages sectionKey="president_greetings" alt="총학생회 회장단 인사말" />
    </>
);

export default PresidentGreeting;
