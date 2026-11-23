/**
 * 오시는 길
 * ==========
 * 이미지로 만들어진 페이지다. 관리자가 콘텐츠 관리(/admin/content)에서 올린
 * 이미지를 그대로 그린다. 이 페이지는 게시글과 무관하다.
 */

import React from "react";

import PageHeader from "../../components/board/PageHeader";
import SectionImages from "../../components/info/SectionImages";
import fallbackImage from "../../assets/images/02_intro_images/오시는길.png";

const Location = () => (
    <>
        <PageHeader title="오시는 길" />
        <SectionImages sectionKey="location" alt="오시는 길 안내" fallback={fallbackImage} />
    </>
);

export default Location;
