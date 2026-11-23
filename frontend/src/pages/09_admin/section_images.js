/**
 * 09_admin/section_images.js
 * ==========================
 * 소개 페이지 섹션 이미지 관리.
 *
 * 지금까지는 각 소개 페이지(president_greeting.js 등)에 업로드 UI 가 흩어져
 * 있었다. 여기서 한 번에 보고 교체한다. 업로드 경로는 기존과 같은
 * POST /api/admin/image (section, image) 이고, 미리보기는
 * GET /api/get-section/<section> 이다.
 *
 * 교체 이미지가 아직 없는 섹션은 미리보기가 404 인데, 그건 정상이다.
 * (소개 페이지는 번들된 기본 이미지로 폴백한다)
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";

import useApi, { useApi_file } from "../../hooks/api/axiosInterceptor";
import { colors, font } from "../../styles/theme";
import {
    AdminDescription, AdminMessage, AdminTitle, AdminWrapper, useAdminGuard,
} from "./adminCommon";

const Grid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 18px;
`;

const ImageCard = styled.div`
    background: ${colors.cardBg};
    border: 1px solid ${colors.border};
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
`;

const Preview = styled.div`
    height: 170px;
    background: ${colors.pageBg};
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;

    img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
    }
`;

const Placeholder = styled.span`
    font-size: 13px;
    color: ${colors.textLight};
`;

const CardBody = styled.div`
    padding: 14px 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const CardName = styled.div`
    font-size: ${font.size.md};
    font-weight: 700;
    color: ${colors.textStrong};
`;

const CardKey = styled.div`
    font-size: 12px;
    color: ${colors.textMuted};
`;

const UploadButton = styled.button`
    align-self: flex-start;
    padding: 7px 14px;
    font-family: ${font.family};
    font-size: 13px;
    border: 1px solid ${colors.border};
    border-radius: 4px;
    background: ${colors.white};
    cursor: pointer;

    &:disabled {
        opacity: 0.5;
        cursor: default;
    }
`;

/**
 * 섹션 키는 서버 admin.py 의 IMAGE_FILENAMES 와 반드시 같아야 한다.
 * 여기 없는 키를 보내면 서버가 "알 수 없는 섹션입니다" 로 거절한다.
 */
const SECTIONS = [
    { key: "president_greetings", name: "총학생회 회장단 인사말" },
    { key: "executive_committee", name: "중앙집행위원회" },
    { key: "sub_committee", name: "산하위원회" },
    { key: "organization_chart", name: "조직도" },
    { key: "location", name: "오시는 길" },
];

const SectionImages = () => {
    const isAdmin = useAdminGuard();
    const inputRefs = useRef({});
    // 캐시를 피하려고 미리보기 URL 에 타임스탬프를 붙인다
    const [stamps, setStamps] = useState({});
    const [uploading, setUploading] = useState(null);
    const [notice, setNotice] = useState(null);

    const bumpStamp = useCallback((key) => {
        setStamps((prev) => ({ ...prev, [key]: Date.now() }));
    }, []);

    useEffect(() => {
        if (!isAdmin) return;
        const now = Date.now();
        setStamps(Object.fromEntries(SECTIONS.map((section) => [section.key, now])));
    }, [isAdmin]);

    const previewUrl = (key) => {
        const base = useApi.defaults.baseURL || "";
        return `${base}/get-section/${key}?t=${stamps[key] || 0}`;
    };

    const handleUpload = async (section, file) => {
        if (!file) return;
        setUploading(section.key);
        setNotice(null);
        try {
            const formData = new FormData();
            formData.append("section", section.key);
            formData.append("image", file);
            const { data } = await useApi_file.post("/admin/image", formData);
            if (data.result !== "SUCCESS") {
                throw new Error(data.message || "업로드에 실패했습니다.");
            }
            bumpStamp(section.key);
            setNotice(`'${section.name}' 이미지를 교체했습니다.`);
        } catch (err) {
            setNotice(`오류: ${err.message}`);
        } finally {
            setUploading(null);
        }
    };

    if (isAdmin === null) return <AdminMessage>확인 중입니다...</AdminMessage>;
    if (!isAdmin) return null;

    return (
        <AdminWrapper>
            <AdminTitle>섹션 이미지 관리</AdminTitle>
            <AdminDescription>
                총학생회 소개 페이지에 쓰이는 이미지입니다. 교체본이 없으면 기본 이미지가 나옵니다.
            </AdminDescription>

            {notice && <AdminMessage>{notice}</AdminMessage>}

            <Grid>
                {SECTIONS.map((section) => (
                    <ImageCard key={section.key}>
                        <Preview>
                            <img
                                src={previewUrl(section.key)}
                                alt={section.name}
                                onError={(e) => {
                                    // 교체본이 없는 정상 상태. 자리표시로 바꾼다.
                                    e.currentTarget.style.display = "none";
                                    const holder = e.currentTarget.nextSibling;
                                    if (holder) holder.style.display = "inline";
                                }}
                            />
                            <Placeholder style={{ display: "none" }}>
                                교체된 이미지 없음 (기본 이미지 사용 중)
                            </Placeholder>
                        </Preview>
                        <CardBody>
                            <CardName>{section.name}</CardName>
                            <CardKey>{section.key}</CardKey>
                            <UploadButton
                                type="button"
                                disabled={uploading === section.key}
                                onClick={() => inputRefs.current[section.key]?.click()}
                            >
                                {uploading === section.key ? "업로드 중..." : "이미지 교체"}
                            </UploadButton>
                            <input
                                ref={(el) => {
                                    inputRefs.current[section.key] = el;
                                }}
                                type="file"
                                accept="image/*"
                                style={{ display: "none" }}
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = "";
                                    handleUpload(section, file);
                                }}
                            />
                        </CardBody>
                    </ImageCard>
                ))}
            </Grid>
        </AdminWrapper>
    );
};

export default SectionImages;
