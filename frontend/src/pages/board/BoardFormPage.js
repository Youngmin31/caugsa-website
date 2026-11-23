/**
 * BoardFormPage
 * =============
 * 게시글 작성/수정 폼. `mode` prop 으로 두 동작을 겸한다.
 * 모든 게시판이 공유하며, 게시판은 라우트의 :board slug 로 결정된다.
 *
 * 본문은 HTML 로 저장되고 상세 화면에서 그대로 그려지므로,
 * 편집도 RichTextEditor(contentEditable)로 한다 — 넣은 이미지가 태그 글자가
 * 아니라 실제 그림으로 보이고 링크도 그대로 보인다.
 *
 * 참여 행사 게시판(config 의 isEvent)은 다른 게시판에 없는 "행사 정보"
 * (시작일·종료일·신청 마감일)를 추가로 받는다. 이 값이 캘린더의 Event 와
 * 메인 화면 카드의 D-day 로 이어진다. 작성뿐 아니라 수정에서도 고칠 수 있다.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styled from "styled-components";

import PageHeader from "../../components/board/PageHeader";
import RichTextEditor from "../../components/board/RichTextEditor";
import { findBoard } from "../../config/boards";
import {
    createPost, fetchPost, updatePost, uploadInlineImage,
} from "../../services/boardService";
import { colors, font, media, radius, shadow } from "../../styles/theme";
import {
    appendHorizontalMarker, hasHorizontalMarker, stripHorizontalMarker,
} from "../../utils/horizontalGallery";

const Card = styled.div`
    max-width: 760px;
    margin: 26px auto 80px;
    background: ${colors.white};
    border: 1px solid ${colors.border};
    border-radius: ${radius.lg};
    box-shadow: ${shadow.card};
    padding: 34px 40px 36px;

    ${media.mobile} {
        padding: 22px 18px 24px;
        margin: 16px auto 50px;
    }
`;

const CardTitle = styled.h2`
    margin: 0 0 26px;
    text-align: center;
    font-family: ${font.family};
    font-size: ${font.size.xl};
    font-weight: ${font.weight.bold};
    color: ${colors.navy};
`;

const Form = styled.form`
    display: flex;
    flex-direction: column;
    gap: 24px;
`;

const Field = styled.div`
    display: flex;
    flex-direction: column;
    gap: 9px;
`;

const Label = styled.label`
    font-family: ${font.family};
    font-size: ${font.size.base};
    font-weight: ${font.weight.semibold};
    color: ${colors.text};
`;

const Input = styled.input`
    width: 100%;
    line-height: 1.4;
    padding: 12px 14px;
    border: 1px solid ${colors.border};
    border-radius: ${radius.md};
    font-family: ${font.family};
    font-size: ${font.size.base};
    color: ${colors.text};
    outline: none;

    &:focus {
        border-color: ${colors.navy};
    }

    &::placeholder {
        color: ${colors.textLight};
    }
`;

/** 참여 행사 전용 묶음. 다른 게시판과 다른 항목이라 눈에 띄게 테를 두른다. */
const EventBox = styled.fieldset`
    margin: 0;
    padding: 20px 22px 22px;
    border: 1px solid #cbd9f1;
    border-radius: ${radius.md};
    background: #f7faff;

    legend {
        padding: 0 8px;
        font-family: ${font.family};
        font-size: ${font.size.base};
        font-weight: ${font.weight.bold};
        color: ${colors.navy};
    }
`;

const EventHint = styled.p`
    margin: 0 0 16px;
    font-family: ${font.family};
    font-size: ${font.size.sm};
    color: ${colors.textMuted};
    line-height: 1.6;
`;

const EventGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;

    ${media.mobile} {
        grid-template-columns: 1fr;
    }
`;

const SmallLabel = styled.label`
    display: block;
    margin-bottom: 7px;
    font-family: ${font.family};
    font-size: ${font.size.sm};
    font-weight: ${font.weight.semibold};
    color: ${colors.text};

    em {
        font-style: normal;
        color: #d14343;
    }
`;

const FileButton = styled.label`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    width: fit-content;
    padding: 10px 18px;
    border: 1px solid ${colors.border};
    border-radius: ${radius.md};
    background: ${colors.pageBg};
    font-family: ${font.family};
    font-size: ${font.size.base};
    color: ${colors.text};
    cursor: pointer;

    &:hover {
        border-color: ${colors.navy};
        color: ${colors.navy};
    }

    input {
        display: none;
    }
`;

const Count = styled.span`
    margin-left: 8px;
    font-weight: ${font.weight.medium};
    color: ${colors.textMuted};
`;

const FileList = styled.ul`
    list-style: none;
    margin: 10px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 7px;
`;

const FileItem = styled.li`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 9px 12px;
    border: 1px solid ${colors.divider};
    border-radius: ${radius.sm};
    background: ${colors.pageBg};
    font-family: ${font.family};
    font-size: ${font.size.sm};
    color: ${colors.text};

    span {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-decoration: ${({ $removed }) => ($removed ? "line-through" : "none")};
        color: ${({ $removed }) => ($removed ? colors.textLight : "inherit")};
    }

    em {
        flex: 0 0 auto;
        font-style: normal;
        color: ${colors.textLight};
    }

    button {
        flex: 0 0 auto;
        width: fit-content;
        padding: 2px 8px;
        border: none;
        background: none;
        color: ${colors.textMuted};
        font-size: ${font.size.sm};
        cursor: pointer;

        &:hover {
            color: #c62828;
        }
    }
`;

const CheckboxLabel = styled.label`
    display: inline-flex;
    align-items: center;
    gap: 9px;
    font-family: ${font.family};
    font-size: ${font.size.base};
    color: ${colors.text};
    cursor: pointer;

    input {
        width: 17px;
        height: 17px;
        accent-color: ${colors.navy};
        cursor: pointer;
    }
`;

const Actions = styled.div`
    display: grid;
    grid-template-columns: 150px 1fr;
    gap: 12px;
    margin-top: 6px;

    ${media.mobile} {
        grid-template-columns: 1fr;
    }
`;

const CancelButton = styled.button`
    padding: 14px 0;
    border: 1px solid ${colors.border};
    border-radius: ${radius.md};
    background: ${colors.white};
    color: ${colors.text};
    font-family: ${font.family};
    font-size: ${font.size.md};
    font-weight: ${font.weight.semibold};
    cursor: pointer;

    &:hover {
        background: ${colors.pageBg};
    }
`;

const SubmitButton = styled.button`
    padding: 14px 0;
    border: 1px solid ${colors.navy};
    border-radius: ${radius.md};
    background: ${colors.navy};
    color: ${colors.onNavy};
    font-family: ${font.family};
    font-size: ${font.size.md};
    font-weight: ${font.weight.semibold};
    cursor: pointer;

    &:disabled {
        opacity: 0.6;
        cursor: default;
    }
`;

const Message = styled.p`
    padding: 70px 0;
    text-align: center;
    font-family: ${font.family};
    font-size: ${font.size.md};
    color: ${colors.textMuted};
`;

const BoardFormPage = ({ mode = "create" }) => {
    const { board: slug, id } = useParams();
    const navigate = useNavigate();

    const boardInfo = useMemo(() => findBoard(slug), [slug]);
    const isEdit = mode === "edit";

    const [post, setPost] = useState({ title: "", content: "" });
    const [isNotice, setIsNotice] = useState(false);
    const [isHorizontal, setIsHorizontal] = useState(false); // 가로형으로 보기 (갤러리 뷰 전용)
    const [eventDate, setEventDate] = useState("");     // 시작일
    const [endDate, setEndDate] = useState("");         // 종료일
    const [formDate, setFormDate] = useState("");       // 신청 마감일
    const [eventName, setEventName] = useState("");     // 캘린더에 뜰 이름
    const [files, setFiles] = useState([]);
    const [existingFiles, setExistingFiles] = useState([]);
    // 뺀 기존 첨부의 id. "수정" 을 눌러야 실제로 지워지고, 그 전엔 되돌릴 수 있다.
    const [removedFileIds, setRemovedFileIds] = useState([]);
    const [isLoading, setIsLoading] = useState(isEdit);
    const [isSaving, setIsSaving] = useState(false);

    // 수정 모드면 기존 내용을 불러온다
    useEffect(() => {
        if (!isEdit || !boardInfo) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const data = await fetchPost(slug, id);
                if (cancelled) return;
                const rawContent = data.content || "";
                setPost({ title: data.title || "", content: stripHorizontalMarker(rawContent) });
                setIsHorizontal(hasHorizontalMarker(rawContent));
                setIsNotice(Boolean(data.isNotice));
                setExistingFiles(data.attachments || []);
                // 행사 글이면 기존 날짜를 그대로 띄운다
                setEventDate((data.startDate || "").slice(0, 10));
                setEndDate((data.endDate || "").slice(0, 10));
                setFormDate((data.applyDue || "").slice(0, 10));
                setEventName(data.eventName || "");
            } catch (err) {
                if (!cancelled) alert(`게시글을 불러오지 못했습니다: ${err.message}`);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isEdit, boardInfo, slug, id]);

    if (!boardInfo) {
        return <Message>존재하지 않는 게시판입니다: {slug}</Message>;
    }
    if (isLoading) {
        return <Message>불러오는 중…</Message>;
    }

    /**
     * <input> 안에서 Enter 를 치면 브라우저가 폼을 곧바로 제출해 버린다
     * (표준 "암시적 제출"). 제목 등 한 줄짜리 입력칸에서는 원치 않는
     * 동작이라 — "등록" 버튼을 눌러야만 올라가야 한다 — 여기서 막는다.
     */
    const blockEnterSubmit = (e) => {
        if (e.key === "Enter") e.preventDefault();
    };

    const handleFileChange = (e) => {
        const selected = Array.from(e.target.files);
        e.target.value = "";
        setFiles((prev) => [...prev, ...selected]);
    };

    const toggleRemoveExisting = (fileId) => {
        setRemovedFileIds((prev) =>
            prev.includes(fileId) ? prev.filter((x) => x !== fileId) : [...prev, fileId]);
    };

    const attachedCount = existingFiles.length - removedFileIds.length + files.length;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!post.title.trim()) {
            alert("제목을 입력해주세요.");
            return;
        }
        // 행사 날짜는 통째로 선택 입력이다 (비우면 캘린더에 올리지 않는다).
        // 다만 넣기로 했으면 시작일과 종료일을 모두 받는다 — 한쪽만 있으면
        // 서버가 나머지를 임의로 채우게 되고, 그렇게 들어간 날짜는 나중에
        // 하나씩 손으로 고쳐야 한다.
        if (boardInfo.isEvent) {
            if (endDate && !eventDate) {
                alert("행사 종료일만 넣을 수는 없습니다. 시작일을 함께 입력해주세요.");
                return;
            }
            if (eventDate && !endDate) {
                alert("행사 종료일도 입력해주세요. 하루짜리 행사면 시작일과 같은 날을 넣으면 됩니다.");
                return;
            }
            if (eventDate && endDate && endDate < eventDate) {
                alert("행사 종료일은 시작일보다 빠를 수 없습니다.");
                return;
            }
        }

        setIsSaving(true);
        try {
            const payload = {
                board: slug,
                title: post.title,
                content: boardInfo.view === "gallery"
                    ? appendHorizontalMarker(post.content, isHorizontal)
                    : post.content,
                files,
                isNotice,
            };
            if (isEdit) {
                payload.deleteAttachmentIds = removedFileIds;
            }
            if (boardInfo.isEvent) {
                payload.event = { eventDate, endDate, formDate, eventName };
            }

            if (isEdit) {
                await updatePost(id, payload);
                alert("게시글이 수정되었습니다.");
            } else {
                await createPost(payload);
                alert("게시글이 등록되었습니다.");
            }
            navigate(boardInfo.path);
        } catch (err) {
            alert(`오류: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <PageHeader
                title={`${boardInfo.name} ${isEdit ? "수정" : "작성"}`}
                crumbs={[
                    { label: "Home", to: "/home" },
                    { label: boardInfo.menuTitle, to: boardInfo.path },
                    { label: boardInfo.name, to: boardInfo.path },
                ]}
            />

            <Card>
                <CardTitle>게시글 {isEdit ? "수정" : "작성"}</CardTitle>

                <Form onSubmit={handleSubmit}>
                    <Field>
                        <Label htmlFor="title">제목</Label>
                        <Input
                            type="text"
                            id="title"
                            name="title"
                            value={post.title}
                            onChange={(e) => setPost((prev) => ({ ...prev, title: e.target.value }))}
                            onKeyDown={blockEnterSubmit}
                            placeholder="제목을 입력하세요"
                            maxLength={255}
                        />
                    </Field>

                    <Field>
                        <Label as="span">내용</Label>
                        <RichTextEditor
                            value={post.content}
                            onChange={(html) => setPost((prev) => ({ ...prev, content: html }))}
                            onUploadImage={uploadInlineImage}
                            placeholder="내용을 입력하세요. 이미지와 링크는 위 버튼으로 넣습니다."
                        />
                    </Field>

                    {boardInfo.isEvent && (
                        <EventBox>
                            <legend>행사 정보</legend>
                            <EventHint>
                                날짜를 비워 두면 캘린더에 올리지 않습니다. 넣을 때는 시작일과
                                종료일을 모두 채워 주세요 (하루짜리면 같은 날). 시작일은 메인 화면
                                카드의 D-day 기준이 됩니다.
                            </EventHint>
                            <Field style={{ marginBottom: 16 }}>
                                <SmallLabel htmlFor="eventName">캘린더 표시 제목</SmallLabel>
                                <Input
                                    type="text"
                                    id="eventName"
                                    value={eventName}
                                    onChange={(e) => setEventName(e.target.value)}
                                    onKeyDown={blockEnterSubmit}
                                    placeholder="비우면 위의 글 제목이 그대로 올라갑니다"
                                    maxLength={255}
                                />
                            </Field>

                            <EventGrid>
                                <div>
                                    <SmallLabel htmlFor="eventDate">행사 시작일</SmallLabel>
                                    <Input
                                        type="date"
                                        id="eventDate"
                                        value={eventDate}
                                        onChange={(e) => setEventDate(e.target.value)}
                                        onKeyDown={blockEnterSubmit}
                                    />
                                </div>
                                <div>
                                    <SmallLabel htmlFor="endDate">
                                        행사 종료일{eventDate && <em> *</em>}
                                    </SmallLabel>
                                    <Input
                                        type="date"
                                        id="endDate"
                                        value={endDate}
                                        min={eventDate || undefined}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        onKeyDown={blockEnterSubmit}
                                    />
                                </div>
                                <div>
                                    <SmallLabel htmlFor="formDate">신청 마감일</SmallLabel>
                                    <Input
                                        type="date"
                                        id="formDate"
                                        value={formDate}
                                        onChange={(e) => setFormDate(e.target.value)}
                                        onKeyDown={blockEnterSubmit}
                                    />
                                </div>
                            </EventGrid>
                        </EventBox>
                    )}

                    <Field>
                        <Label as="span">
                            첨부파일
                            {attachedCount > 0 && <Count>{attachedCount}개</Count>}
                        </Label>
                        <FileButton>
                            파일 업로드
                            <input type="file" multiple onChange={handleFileChange} />
                        </FileButton>

                        {(existingFiles.length > 0 || files.length > 0) && (
                            <FileList>
                                {existingFiles.map((file) => {
                                    const removed = removedFileIds.includes(file.id);
                                    return (
                                        <FileItem key={`existing-${file.id}`} $removed={removed}>
                                            <span>{file.name}</span>
                                            <em>{removed ? "삭제 예정" : "기존"}</em>
                                            <button
                                                type="button"
                                                onClick={() => toggleRemoveExisting(file.id)}
                                                aria-label={`${file.name} ${removed ? "되돌리기" : "삭제"}`}
                                            >
                                                {removed ? "되돌리기" : "삭제"}
                                            </button>
                                        </FileItem>
                                    );
                                })}
                                {files.map((file, index) => (
                                    <FileItem key={`new-${index}`}>
                                        <span>{file.name}</span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setFiles((prev) => prev.filter((_, i) => i !== index))
                                            }
                                            aria-label={`${file.name} 빼기`}
                                        >
                                            빼기
                                        </button>
                                    </FileItem>
                                ))}
                            </FileList>
                        )}
                    </Field>

                    <Field>
                        <CheckboxLabel>
                            <input
                                type="checkbox"
                                checked={isNotice}
                                onChange={(e) => setIsNotice(e.target.checked)}
                            />
                            공지로 등록 (목록 상단 고정
                            {boardInfo.isEvent ? ", 메인 화면 노출" : ""})
                        </CheckboxLabel>
                    </Field>

                    {boardInfo.view === "gallery" && (
                        <Field>
                            <CheckboxLabel>
                                <input
                                    type="checkbox"
                                    checked={isHorizontal}
                                    onChange={(e) => setIsHorizontal(e.target.checked)}
                                />
                                가로형으로 보기 (첨부 이미지 3장을 이어 붙여 하나의 가로
                                이미지처럼 표시, 카드뉴스 3분할 게시물용)
                            </CheckboxLabel>
                        </Field>
                    )}

                    <Actions>
                        <CancelButton type="button" onClick={() => navigate(boardInfo.path)}>
                            취소
                        </CancelButton>
                        <SubmitButton type="submit" disabled={isSaving}>
                            {isSaving ? "저장 중…" : isEdit ? "수정" : "등록"}
                        </SubmitButton>
                    </Actions>
                </Form>
            </Card>
        </>
    );
};

export default BoardFormPage;
