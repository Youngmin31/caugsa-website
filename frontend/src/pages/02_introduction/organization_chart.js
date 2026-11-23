/**
 * 조직 및 업무
 * ==============
 * 이미지로 만들어진 페이지다. 관리자가 콘텐츠 관리(/admin/content)에서 올린
 * 이미지를 그대로 그린다. 이 페이지는 게시글과 무관하다.
 */

import React from "react";

import PageHeader from "../../components/board/PageHeader";
import SectionImages from "../../components/info/SectionImages";
import fallbackImage from "../../assets/images/02_intro_images/조직도.png";

const OrganizationChart = () => (
    <>
        <PageHeader title="조직 및 업무" />
        <SectionImages sectionKey="organization_chart" alt="조직도" fallback={fallbackImage} />
    </>
);

export default OrganizationChart;
