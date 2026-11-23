/**
 * 회원가입
 * ========
 * 로그인 화면과 같은 카드 폼. 항목이 많아 세 덩어리로 나눴다.
 *
 *   기본 정보 : 이름 / 아이디 / 비밀번호
 *   학적 정보 : 단과대 · 학과 · 학번  (User.college / major / student_id)
 *   연락처    : 휴대전화 / 포탈 메일 인증 / 예비 메일
 *
 * 포탈 메일 인증(email_verify -> verify_code)을 통과해야 가입이 된다.
 * 서버가 register 에서 인증 기록을 다시 확인하므로 건너뛸 수 없다.
 */

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import styled from "styled-components";

import { useApi } from "../../hooks/api/axiosInterceptor";
import PageHeader from "../../components/board/PageHeader";
import { COLLEGES, hasMajor, majorsOf } from "../../config/colleges";
import PasswordField from "../../components/form/PasswordField";
import { colors, font, media, radius, shadow } from "../../styles/theme";
import { isValidPassword, PASSWORD_RULE_MESSAGE } from "../../utils/password";

const PORTAL_DOMAIN = "@cau.ac.kr";

/** validateForm 의 newErrors 키를, 화면에 보이는 순서로 나열한다 (에러 스크롤용). */
const SIGNUP_FIELD_ORDER = [
    "name", "userId", "password", "confirmPassword",
    "college", "major", "studentId", "phone", "email",
];

/**
 * 서버 응답의 성공 판정.
 *
 * 이 백엔드는 두 가지 형태를 섞어 쓴다 — 회원가입은 {"result": "SUCCESS"},
 * 메일 인증·로그인 등은 {"status": "SUCCESS"} 다 (helpers.py 의 ok_result / ok_status).
 * 어느 쪽이 와도 맞게 읽는다.
 */
const isSuccess = (data) =>
    Boolean(data) && (data.status === "SUCCESS" || data.result === "SUCCESS");

const Card = styled.div`
    max-width: 700px;
    margin: 40px auto 90px;
    background: ${colors.white};
    border-radius: ${radius.lg};
    box-shadow: ${shadow.card};
    padding: 48px 60px 40px;

    ${media.mobile} {
        padding: 30px 22px 28px;
        margin: 20px auto 50px;
    }
`;

const Form = styled.form`
    display: flex;
    flex-direction: column;
    /* 덩어리 사이 */
    gap: 44px;
`;

const Section = styled.section`
    display: flex;
    flex-direction: column;
    /* 문항 사이. 답변 상자가 서로 붙어 보이지 않게 넉넉히 띄운다. */
    gap: 28px;
`;

const SectionLabel = styled.h3`
    margin: 0;
    /* 아래 첫 문항과는 Section 의 gap 보다 조금 붙여 둔다 */
    margin-bottom: -6px;
    padding-bottom: 10px;
    border-bottom: 1px solid ${colors.divider};
    font-family: ${font.family};
    font-size: ${font.size.md};
    font-weight: ${font.weight.bold};
    color: ${colors.navy};
`;

const FormGroup = styled.div`
    display: flex;
    flex-direction: column;
    /* 라벨과 답변 상자 사이 */
    gap: 10px;
`;

/** 짝지어 놓는 두 칸. 좁은 화면에서는 한 줄씩 내려간다. */
const Pair = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 28px;

    ${media.mobile} {
        grid-template-columns: 1fr;
    }
`;

const Label = styled.label`
    font-family: ${font.family};
    font-size: ${font.size.base};
    font-weight: ${font.weight.semibold};
    color: ${colors.text};

    span {
        margin-left: 4px;
        color: #d14343;
    }
`;

const Input = styled.input`
    width: 100%;
    line-height: 1.4;
    padding: 14px 16px;
    border: 1px solid ${colors.border};
    border-radius: ${radius.md};
    font-family: ${font.family};
    font-size: ${font.size.base};
    color: ${colors.text};
    outline: none;
    transition: border-color 0.15s ease;

    &::placeholder {
        color: ${colors.textLight};
    }

    &:focus {
        border-color: ${colors.navy};
    }

    &:disabled {
        background: ${colors.pageBg};
        color: ${colors.textMuted};
    }
`;

/** 드롭다운. 입력칸과 같은 모양에 오른쪽 화살표만 얹는다. */
const Select = styled.select`
    width: 100%;
    line-height: 1.4;
    padding: 14px 44px 14px 16px;
    border: 1px solid ${colors.border};
    border-radius: ${radius.md};
    font-family: ${font.family};
    font-size: ${font.size.base};
    color: ${(props) => (props.value ? colors.text : colors.textLight)};
    background-color: ${colors.white};
    /* 기본 화살표를 지우고 직접 그린다 (브라우저마다 모양이 달라서) */
    appearance: none;
    background-image: linear-gradient(45deg, transparent 50%, ${colors.textMuted} 50%),
        linear-gradient(135deg, ${colors.textMuted} 50%, transparent 50%);
    background-position: calc(100% - 21px) 22px, calc(100% - 16px) 22px;
    background-size: 5px 5px, 5px 5px;
    background-repeat: no-repeat;
    outline: none;
    cursor: pointer;
    transition: border-color 0.15s ease;

    &:focus {
        border-color: ${colors.navy};
    }

    &:disabled {
        background-color: ${colors.pageBg};
        color: ${colors.textLight};
        cursor: default;
    }

    option {
        color: ${colors.text};
    }
`;

/** 입력칸 + 옆 버튼 (인증 요청 / 확인) */
const InlineRow = styled.div`
    display: flex;
    align-items: stretch;
    gap: 10px;
`;

const InlineField = styled.div`
    /* basis 0 으로 두어 남는 폭을 전부 가져간다 */
    flex: 1 1 0;
    min-width: 0;
    position: relative;
    display: flex;
    align-items: center;

    input {
        padding-right: ${(props) => (props.$suffix ? "104px" : "16px")};
    }

    /* 포탈 주소는 고정이라 입력칸 안에 붙여 둔다 */
    em {
        position: absolute;
        right: 16px;
        font-style: normal;
        font-family: ${font.family};
        font-size: ${font.size.base};
        color: ${colors.text};
        pointer-events: none;
    }
`;

const InlineButton = styled.button`
    flex: 0 0 auto;
    /* reset.js 가 button 에 width: 100% 를 걸어 두어 그냥 두면 줄을 다 먹는다 */
    width: fit-content;
    padding: 0 18px;
    border: 1px solid ${colors.navy};
    border-radius: ${radius.md};
    background: ${colors.white};
    color: ${colors.navy};
    font-family: ${font.family};
    font-size: ${font.size.base};
    font-weight: ${font.weight.semibold};
    white-space: nowrap;
    cursor: pointer;

    &:hover:not(:disabled) {
        background: ${colors.pageBg};
    }

    &:disabled {
        border-color: ${colors.border};
        color: ${colors.textLight};
        cursor: default;
    }
`;

/** 세 칸을 하이픈으로 잇는다. 칸은 같은 폭으로 늘어난다. */
const PhoneRow = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;

    input {
        flex: 1 1 0;
        min-width: 0;
        text-align: center;
    }
`;

const PhoneDash = styled.span`
    flex: 0 0 auto;
    font-family: ${font.family};
    font-size: ${font.size.md};
    color: ${colors.textLight};
    user-select: none;
`;

const HelpText = styled.p`
    margin: 0;
    font-family: ${font.family};
    font-size: ${font.size.sm};
    color: ${colors.textMuted};
`;

const VerifiedText = styled.p`
    margin: 0;
    font-family: ${font.family};
    font-size: ${font.size.sm};
    font-weight: ${font.weight.semibold};
    color: #1a7f4b;
`;

const ErrorMessage = styled.p`
    margin: 0;
    font-family: ${font.family};
    font-size: ${font.size.sm};
    color: #d14343;
`;

const ButtonContainer = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-top: 4px;
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

const HelpLinks = styled.div`
    display: flex;
    gap: 22px;
    margin-top: 18px;
`;

const StyledLink = styled(Link)`
    font-family: ${font.family};
    font-size: ${font.size.sm};
    color: ${colors.textMuted};
    text-decoration: none;

    &:hover {
        color: ${colors.navy};
        text-decoration: underline;
    }
`;

const Signup = () => {
    const [formData, setFormData] = useState({
        name: "",
        userId: "",
        password: "",
        confirmPassword: "",
        college: "",
        major: "",
        studentId: "",
        phone1: "",
        phone2: "",
        phone3: "",
        email: "",
        backupEmail: "",
    });

    const [errors, setErrors] = useState({});
    const [emailVerificationCode, setEmailVerificationCode] = useState("");
    const [isEmailVerified, setIsEmailVerified] = useState(false);
    const [codeSent, setCodeSent] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }
    };

    /** 단과대를 바꾸면 그 아래에 없는 학과는 비운다 */
    const handleCollegeChange = (e) => {
        const college = e.target.value;
        setFormData((prev) => ({
            ...prev,
            college,
            major: hasMajor(college, prev.major) ? prev.major : "",
        }));
        setErrors((prev) => ({ ...prev, college: "", major: "" }));
    };

    /** 숫자만 받는 칸 (휴대전화, 학번) */
    const handleDigitChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value.replace(/\D/g, "") }));
        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: "" }));
        }
    };

    const requestEmailVerification = async () => {
        if (!formData.email) {
            setErrors((prev) => ({ ...prev, email: "포탈 아이디를 입력해주세요" }));
            return;
        }

        try {
            const response = await useApi.post("/auth/email_verify", {
                email: `${formData.email}${PORTAL_DOMAIN}`,
                name: formData.name,
            });

            if (isSuccess(response.data)) {
                setCodeSent(true);
                alert("인증 코드가 이메일로 전송되었습니다. 메일함을 확인해주세요.");
            } else {
                alert((response.data && response.data.message) || "이메일 인증 요청에 실패했습니다.");
            }
        } catch (error) {
            console.error("이메일 인증 요청 오류:", error);
            alert(
                (error.response && error.response.data && error.response.data.message) ||
                    "이메일 인증 요청 중 오류가 발생했습니다."
            );
        }
    };

    const verifyEmailCode = async () => {
        if (!emailVerificationCode) {
            alert("인증 코드를 입력해주세요.");
            return;
        }

        try {
            const response = await useApi.post("/auth/verify_code", {
                email: `${formData.email}${PORTAL_DOMAIN}`,
                code: emailVerificationCode,
            });

            if (isSuccess(response.data)) {
                alert("이메일이 성공적으로 인증되었습니다.");
                setIsEmailVerified(true);
                setCodeSent(false);
                setErrors((prev) => ({ ...prev, email: "" }));
            } else {
                alert((response.data && response.data.message) || "인증 코드가 일치하지 않습니다.");
            }
        } catch (error) {
            console.error("이메일 인증 확인 오류:", error);
            alert(
                (error.response && error.response.data && error.response.data.message) ||
                    "이메일 인증 확인 중 오류가 발생했습니다."
            );
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = "이름을 입력해주세요";
        }

        if (!formData.userId.trim()) {
            newErrors.userId = "아이디를 입력해주세요";
        } else if (!/^[a-zA-Z0-9]{4,16}$/.test(formData.userId)) {
            newErrors.userId = "아이디는 4~16자의 영문 또는 숫자여야 합니다";
        }

        if (!formData.password) {
            newErrors.password = "비밀번호를 입력해주세요";
        } else if (!isValidPassword(formData.password)) {
            newErrors.password = PASSWORD_RULE_MESSAGE;
        }

        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = "비밀번호가 일치하지 않습니다";
        }

        // 학적 정보 — DB 의 college / major / student_id 로 그대로 들어간다
        if (!formData.college) {
            newErrors.college = "단과대를 선택해주세요";
        }

        if (!formData.major) {
            newErrors.major = "학과를 선택해주세요";
        }

        if (!formData.studentId.trim()) {
            newErrors.studentId = "학번을 입력해주세요";
        } else if (!/^\d{4,12}$/.test(formData.studentId)) {
            newErrors.studentId = "학번은 숫자 4~12자리여야 합니다";
        }

        if (!formData.phone1 || !formData.phone2 || !formData.phone3) {
            newErrors.phone = "연락처를 모두 입력해주세요";
        } else if (
            !/^\d{2,3}$/.test(formData.phone1) ||
            !/^\d{3,4}$/.test(formData.phone2) ||
            !/^\d{4}$/.test(formData.phone3)
        ) {
            newErrors.phone = "유효한 연락처를 입력해주세요";
        }

        if (!formData.email) {
            newErrors.email = "포탈 이메일을 입력해주세요";
        }

        setErrors(newErrors);

        // 조건을 만족 못 한 항목이 있으면, 화면 순서상 가장 위에 있는 항목으로
        // 스크롤해 보여준다. phone 은 세 칸으로 나뉜 입력 중 첫 칸으로 보낸다.
        const firstErrorKey = SIGNUP_FIELD_ORDER.find((key) => newErrors[key]);
        if (firstErrorKey) {
            const fieldId = firstErrorKey === "phone" ? "phone1" : firstErrorKey;
            document.getElementById(fieldId)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }

        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setSubmitting(true);
        try {
            const response = await useApi.post("/auth/register", {
                name: formData.name,
                userId: formData.userId,
                password: formData.password,
                college: formData.college,
                major: formData.major,
                // 서버가 앞자리 0 을 지키려고 문자열로 저장한다
                studentId: formData.studentId,
                phone: `${formData.phone1}-${formData.phone2}-${formData.phone3}`,
                email: formData.email,
                backupEmail: formData.backupEmail || null,
            });

            if (isSuccess(response.data)) {
                alert("회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.");
                navigate("/intro/login");
            } else {
                alert(response.data.message || "회원가입에 실패했습니다.");
            }
        } catch (error) {
            console.error("회원가입 오류:", error);
            // 4xx 응답은 axios 가 예외로 던지므로 서버 메시지를 여기서 꺼내 보여준다.
            // (아이디 중복 / 이메일 중복 / 메일 인증 미완료 안내가 모두 이 경로로 온다)
            alert(
                (error.response && error.response.data && error.response.data.message) ||
                    "회원가입 처리 중 오류가 발생했습니다."
            );
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = () => {
        if (window.confirm("회원가입을 취소하시겠습니까?")) {
            navigate("/intro/login");
        }
    };

    return (
        <>
            <PageHeader
                title="회원가입"
                crumbs={[{ label: "Home", to: "/home" }, { label: "회원가입" }]}
            />
            <Card>
                <Form onSubmit={handleSubmit}>
                    <Section>
                        <SectionLabel>기본 정보</SectionLabel>

                        <FormGroup>
                            <Label htmlFor="name">
                                이름<span>*</span>
                            </Label>
                            <Input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="이름을 입력하세요"
                                autoComplete="name"
                            />
                            {errors.name && <ErrorMessage>{errors.name}</ErrorMessage>}
                        </FormGroup>

                        <FormGroup>
                            <Label htmlFor="userId">
                                아이디<span>*</span>
                            </Label>
                            <Input
                                type="text"
                                id="userId"
                                name="userId"
                                value={formData.userId}
                                onChange={handleChange}
                                placeholder="4~16자의 영문 또는 숫자"
                                autoComplete="username"
                            />
                            {errors.userId && <ErrorMessage>{errors.userId}</ErrorMessage>}
                        </FormGroup>

                        <Pair>
                            <FormGroup>
                                <Label htmlFor="password">
                                    비밀번호<span>*</span>
                                </Label>
                                <PasswordField
                                    id="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="영문, 숫자, 특수문자 포함 8~20자"
                                    autoComplete="new-password"
                                />
                                {errors.password && <ErrorMessage>{errors.password}</ErrorMessage>}
                            </FormGroup>

                            <FormGroup>
                                <Label htmlFor="confirmPassword">
                                    비밀번호 확인<span>*</span>
                                </Label>
                                <PasswordField
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="비밀번호를 다시 입력하세요"
                                    autoComplete="new-password"
                                />
                                {errors.confirmPassword && (
                                    <ErrorMessage>{errors.confirmPassword}</ErrorMessage>
                                )}
                            </FormGroup>
                        </Pair>
                    </Section>

                    <Section>
                        <SectionLabel>학적 정보</SectionLabel>

                        <Pair>
                            <FormGroup>
                                <Label htmlFor="college">
                                    단과대<span>*</span>
                                </Label>
                                <Select
                                    id="college"
                                    name="college"
                                    value={formData.college}
                                    onChange={handleCollegeChange}
                                >
                                    <option value="">단과대를 선택하세요</option>
                                    {COLLEGES.map((college) => (
                                        <option key={college.name} value={college.name}>
                                            {college.name}
                                        </option>
                                    ))}
                                </Select>
                                {errors.college && <ErrorMessage>{errors.college}</ErrorMessage>}
                            </FormGroup>

                            <FormGroup>
                                <Label htmlFor="major">
                                    학과<span>*</span>
                                </Label>
                                <Select
                                    id="major"
                                    name="major"
                                    value={formData.major}
                                    onChange={handleChange}
                                    disabled={!formData.college}
                                >
                                    <option value="">
                                        {formData.college ? "학과를 선택하세요" : "단과대를 먼저 선택하세요"}
                                    </option>
                                    {majorsOf(formData.college).map((major) => (
                                        <option key={major} value={major}>
                                            {major}
                                        </option>
                                    ))}
                                </Select>
                                {errors.major && <ErrorMessage>{errors.major}</ErrorMessage>}
                            </FormGroup>
                        </Pair>

                        <FormGroup>
                            <Label htmlFor="studentId">
                                학번<span>*</span>
                            </Label>
                            <Input
                                type="text"
                                inputMode="numeric"
                                id="studentId"
                                name="studentId"
                                value={formData.studentId}
                                onChange={handleDigitChange}
                                placeholder="숫자만 입력하세요"
                                maxLength={12}
                            />
                            {errors.studentId ? (
                                <ErrorMessage>{errors.studentId}</ErrorMessage>
                            ) : (
                                <HelpText>학생 인증과 행사 참여 확인에 쓰입니다.</HelpText>
                            )}
                        </FormGroup>
                    </Section>

                    <Section>
                        <SectionLabel>연락처</SectionLabel>

                        <FormGroup>
                            <Label htmlFor="phone1">
                                휴대전화<span>*</span>
                            </Label>
                            <PhoneRow>
                                <Input
                                    type="text"
                                    inputMode="numeric"
                                    id="phone1"
                                    name="phone1"
                                    value={formData.phone1}
                                    onChange={handleDigitChange}
                                    maxLength={3}
                                    placeholder="010"
                                />
                                <PhoneDash aria-hidden="true">-</PhoneDash>
                                <Input
                                    type="text"
                                    inputMode="numeric"
                                    name="phone2"
                                    value={formData.phone2}
                                    onChange={handleDigitChange}
                                    maxLength={4}
                                    placeholder="0000"
                                    aria-label="휴대전화 가운데 자리"
                                />
                                <PhoneDash aria-hidden="true">-</PhoneDash>
                                <Input
                                    type="text"
                                    inputMode="numeric"
                                    name="phone3"
                                    value={formData.phone3}
                                    onChange={handleDigitChange}
                                    maxLength={4}
                                    placeholder="0000"
                                    aria-label="휴대전화 끝자리"
                                />
                            </PhoneRow>
                            {errors.phone && <ErrorMessage>{errors.phone}</ErrorMessage>}
                        </FormGroup>

                        <FormGroup>
                            <Label htmlFor="email">
                                포탈 이메일<span>*</span>
                            </Label>
                            <InlineRow>
                                <InlineField $suffix>
                                    <Input
                                        type="text"
                                        id="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="포탈 아이디"
                                        disabled={isEmailVerified}
                                        autoComplete="off"
                                    />
                                    <em>{PORTAL_DOMAIN}</em>
                                </InlineField>
                                <InlineButton
                                    type="button"
                                    onClick={requestEmailVerification}
                                    disabled={isEmailVerified}
                                >
                                    {codeSent ? "재발송" : "인증 요청"}
                                </InlineButton>
                            </InlineRow>
                            {errors.email && <ErrorMessage>{errors.email}</ErrorMessage>}
                            {isEmailVerified && <VerifiedText>이메일 인증이 완료되었습니다.</VerifiedText>}
                        </FormGroup>

                        {/* 인증이 끝나기 전에는 늘 보여 준다. 메일이 늦게 도착하거나
                            발송 응답을 놓쳐도 받은 코드를 바로 넣을 수 있어야 한다. */}
                        {!isEmailVerified && (
                            <FormGroup>
                                <Label htmlFor="verificationCode">인증 코드</Label>
                                <InlineRow>
                                    <InlineField>
                                        <Input
                                            type="text"
                                            id="verificationCode"
                                            value={emailVerificationCode}
                                            onChange={(e) => setEmailVerificationCode(e.target.value)}
                                            placeholder="메일로 받은 코드를 입력하세요"
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                        />
                                    </InlineField>
                                    <InlineButton
                                        type="button"
                                        onClick={verifyEmailCode}
                                        disabled={!emailVerificationCode.trim()}
                                    >
                                        확인
                                    </InlineButton>
                                </InlineRow>
                                <HelpText>
                                    {codeSent
                                        ? "인증 코드가 이메일로 전송되었습니다. 메일함을 확인해주세요."
                                        : "위 인증 요청을 누르면 코드가 전송됩니다."}
                                </HelpText>
                            </FormGroup>
                        )}

                        <FormGroup>
                            <Label htmlFor="backupEmail">예비 이메일</Label>
                            <Input
                                type="email"
                                id="backupEmail"
                                name="backupEmail"
                                value={formData.backupEmail}
                                onChange={handleChange}
                                placeholder="비밀번호 찾기 등에 사용됩니다 (선택)"
                                autoComplete="email"
                            />
                        </FormGroup>
                    </Section>

                    <ButtonContainer>
                        <CancelButton type="button" onClick={handleCancel}>
                            취소
                        </CancelButton>
                        <SubmitButton type="submit" disabled={submitting}>
                            {submitting ? "가입 중…" : "가입하기"}
                        </SubmitButton>
                    </ButtonContainer>
                </Form>

                <HelpLinks>
                    <StyledLink to="/intro/login">이미 계정이 있으신가요? 로그인</StyledLink>
                </HelpLinks>
            </Card>
        </>
    );
};

export default Signup;
