import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import styled from "styled-components";

import { useApi } from "../../hooks/api/axiosInterceptor";
import PageHeader from "../../components/board/PageHeader";
import PasswordField from "../../components/form/PasswordField";
import { colors, font, media, radius, shadow } from "../../styles/theme";

// 재활성화 마감 안내 배너를 띄울 기간. 11월 30일(KST)까지만 보여주고,
// 그 이후엔 날짜 조건으로 자동으로 사라진다 — 마감 지나서도 뜨는 걸 막으려고
// 수동으로 지우지 않아도 되게 하기 위함이다.
const REACTIVATION_DEADLINE = new Date("2026-12-01T00:00:00+09:00");

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
    gap: 18px;
`;

const FormGroup = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const Label = styled.label`
    font-family: ${font.family};
    font-size: ${font.size.base};
    font-weight: ${font.weight.semibold};
    color: ${colors.text};
`;

const Input = styled.input`
    width: 100%;
    /* 비밀번호 칸(PasswordField)과 높이를 맞춘다 */
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
`;

const ErrorMessage = styled.p`
    margin: 0;
    font-family: ${font.family};
    font-size: ${font.size.sm};
    color: #d14343;
`;

const ReactivationNotice = styled.div`
    margin-bottom: 20px;
    padding: 14px 16px;
    background: #eef3fc;
    border-left: 3px solid ${colors.navy};
    border-radius: 4px;
    font-family: ${font.family};
    font-size: ${font.size.sm};
    color: ${colors.text};
    line-height: 1.5;
    white-space: pre-line;
`;

const ButtonContainer = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-top: 10px;
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

const SignUpButton = styled(Link)`
    padding: 14px 0;
    border: 1px solid ${colors.border};
    border-radius: ${radius.md};
    background: ${colors.white};
    color: ${colors.text};
    font-family: ${font.family};
    font-size: ${font.size.md};
    font-weight: ${font.weight.semibold};
    text-align: center;
    text-decoration: none;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
        background: ${colors.pageBg};
    }
`;

const HelpLinks = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 22px;
    margin-top: 18px;
`;

const StyledLink = styled(Link)`
    font-family: ${font.family};
    font-size: ${font.size.sm};
    color: ${colors.textMuted};
    text-decoration: none;
    white-space: nowrap;

    &:hover {
        color: ${colors.navy};
        text-decoration: underline;
    }
`;

const ModalOverlay = styled.div`
    position: fixed;
    inset: 0;
    background: rgba(18, 24, 80, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    z-index: 1000;
`;

const ModalBox = styled.div`
    width: 100%;
    /* 본문 문장이 한 줄에 들어오도록 넉넉히 넓힌다(기존 380px는 너무 좁아
       문장이 엉뚱한 자리에서 줄바꿈됐다). 모바일은 어차피 한 줄로 못 넣으니
       화면 폭에 맞춰 줄바꿈을 허용한다. */
    max-width: 760px;
    background: ${colors.white};
    border-radius: ${radius.lg};
    box-shadow: ${shadow.card};
    padding: 36px 40px 28px;
    text-align: center;

    ${media.mobile} {
        max-width: 92vw;
        padding: 28px 22px 22px;
    }
`;

const ModalTitle = styled.h2`
    margin: 0 0 16px;
    font-family: ${font.family};
    font-size: ${font.size.lg};
    font-weight: ${font.weight.bold};
    color: ${colors.text};
`;

const ModalParagraph = styled.p`
    margin: 0 0 10px;
    font-family: ${font.family};
    font-size: ${font.size.base};
    color: ${colors.textMuted};
    line-height: 1.6;

    strong {
        color: ${colors.text};
        font-weight: ${font.weight.bold};
    }
`;

const ModalStepsLine = styled.p`
    margin: 0 0 20px;
    font-family: ${font.family};
    font-size: ${font.size.sm};
    color: ${colors.textLight};
`;

const ModalDivider = styled.hr`
    margin: 0 0 16px;
    border: none;
    border-top: 1px solid ${colors.border};
`;

const ModalDeadlineRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin: 0 0 24px;
    font-family: ${font.family};
    font-size: ${font.size.sm};
    font-weight: ${font.weight.semibold};
    color: ${colors.text};

    svg {
        flex: 0 0 auto;
        color: ${colors.navy};
    }
`;

const ModalButtons = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
`;

const ModalSecondaryLinkRow = styled.div`
    margin-top: 14px;
    text-align: center;
`;

const ModalGhostButton = styled.button`
    padding: 12px 0;
    border: 1px solid ${colors.border};
    border-radius: ${radius.md};
    background: ${colors.white};
    color: ${colors.text};
    font-family: ${font.family};
    font-size: ${font.size.base};
    font-weight: ${font.weight.semibold};
    cursor: pointer;

    &:hover {
        background: ${colors.pageBg};
    }
`;

const ModalPrimaryButton = styled(Link)`
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 0;
    border: 1px solid ${colors.navy};
    border-radius: ${radius.md};
    background: ${colors.navy};
    color: ${colors.onNavy};
    font-family: ${font.family};
    font-size: ${font.size.base};
    font-weight: ${font.weight.semibold};
    text-decoration: none;
`;

const InfoIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 11v5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="12" cy="8" r="0.9" fill="currentColor" />
    </svg>
);

const Login = () => {
    const [formData, setFormData] = useState({
        username: '',
        password: ''
    });
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    // 11/30까지는 로그인 화면에 들어오면 무조건 한 번 띄운다(아직 로그인
    // 시도 전이라도). 활성화를 이미 끝낸 사람은 "닫기"로 넘어가고, 로그인에
    // 실패했는데 서버가 needs_reactivation을 주는 경우(이 모달을 닫고 다시
    // 시도했을 때 등)에도 똑같이 뜨도록 트리거를 하나 더 둔다.
    const [showReactivateModal, setShowReactivateModal] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (new Date() < REACTIVATION_DEADLINE) {
            setShowReactivateModal(true);
        }
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });
        
        // 입력 시 해당 필드의 에러 메시지 초기화
        if (errors[name]) {
            setErrors({
                ...errors,
                [name]: ''
            });
        }
    };

    const validateForm = () => {
        const newErrors = {};
        
        if (!formData.username.trim()) {
            newErrors.username = '아이디를 입력해주세요';
        }
        
        if (!formData.password) {
            newErrors.password = '비밀번호를 입력해주세요';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }
        
        setIsLoading(true);
        
        try {
            const response = await useApi.post('/auth/login', {
                username: formData.username,
                password: formData.password
            });
            
            if (response.data.status === 'SUCCESS') {
                const userData = response.data.data.user;
                localStorage.setItem("access_token", response.data.data.access_token);
                localStorage.setItem('refresh_token', response.data.data.refresh_token);
                localStorage.setItem('user_role', userData.role);  // 여기에 'role' 값 저장
                localStorage.setItem('user_role_detail', userData.roleDetail || '');  // ADMIN/MANAGER 구분용

                navigate('/home');
            } else {
                setErrors({
                    form: response.data.message || '로그인에 실패했습니다. 아이디와 비밀번호를 확인해주세요.'
                });
            }
        } catch (error) {
            console.error('로그인 오류:', error);

            // 레거시 이관 계정이라 비밀번호가 옮겨지지 않은 경우: 일반 오류 문구 대신
            // 계정 활성화로 안내하는 팝업을 띄운다.
            if (error.response?.data?.error_code === 'needs_reactivation') {
                setShowReactivateModal(true);
            } else {
                setErrors({
                    form: error.response?.data?.message
                        || '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
                });
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <PageHeader title="로그인" crumbs={[{ label: "Home", to: "/home" }, { label: "로그인" }]} />
            <Card>
                {new Date() < REACTIVATION_DEADLINE && (
                    <ReactivationNotice>
                        {"기존 회원은 로그인 전에 계정 활성화가 필요합니다.\n"
                            + "11월 30일까지 활성화하지 않은 계정은 삭제됩니다."}
                    </ReactivationNotice>
                )}
                <Form onSubmit={handleSubmit}>
                    <FormGroup>
                        <Label htmlFor="username">아이디</Label>
                        <Input
                            type="text"
                            id="username"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            placeholder="아이디를 입력하세요"
                        />
                        {errors.username && <ErrorMessage>{errors.username}</ErrorMessage>}
                    </FormGroup>
                    
                    <FormGroup>
                        <Label htmlFor="password">비밀번호</Label>
                        <PasswordField
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="비밀번호를 입력하세요"
                            autoComplete="current-password"
                        />
                        {errors.password && <ErrorMessage>{errors.password}</ErrorMessage>}
                    </FormGroup>
                    
                    {errors.form && <ErrorMessage>{errors.form}</ErrorMessage>}
                    
                    <ButtonContainer>
                        <SubmitButton type="submit" disabled={isLoading}>
                            {isLoading ? '로그인 중...' : '로그인'}
                        </SubmitButton>
                        <SignUpButton to="/intro/signup">
                            회원가입
                        </SignUpButton>
                    </ButtonContainer>
                </Form>
                
                <HelpLinks>
                    <StyledLink to="/intro/login/id-search">아이디 찾기</StyledLink>
                    <StyledLink to="/intro/login/pw-search">비밀번호 찾기</StyledLink>
                    {/* 기존 회원 계정 활성화 — 한시적. 끝나면 이 줄만 지운다 */}
                    <StyledLink to="/intro/reactivate">기존 회원 계정 활성화</StyledLink>
                </HelpLinks>
            </Card>

            {showReactivateModal && (
                <ModalOverlay onClick={() => setShowReactivateModal(false)}>
                    <ModalBox onClick={(e) => e.stopPropagation()}>
                        <ModalTitle>기존 계정 활성화 안내</ModalTitle>
                        <ModalParagraph>
                            홈페이지 리뉴얼에 따라 계정 보안 기준 및 회원정보 수집 항목이 변경되었습니다.
                        </ModalParagraph>
                        <ModalParagraph>
                            기존 회원은 <strong>학교 이메일 인증을 통한 재학 정보 확인 및 계정 활성화 절차</strong>를
                            완료해야 로그인할 수 있습니다.
                        </ModalParagraph>
                        <ModalStepsLine>학교 이메일 인증 · 비밀번호 재설정 · 추가 정보 입력</ModalStepsLine>
                        <ModalDivider />
                        <ModalDeadlineRow>
                            <InfoIcon />
                            2026년 11월 30일까지 계정 활성화를 완료하지 않은 경우, 해당 계정은 삭제됩니다.
                        </ModalDeadlineRow>
                        <ModalButtons>
                            <ModalGhostButton
                                type="button"
                                onClick={() => setShowReactivateModal(false)}
                            >
                                닫기
                            </ModalGhostButton>
                            <ModalPrimaryButton to="/intro/reactivate">
                                계정 활성화하기
                            </ModalPrimaryButton>
                        </ModalButtons>
                        <ModalSecondaryLinkRow>
                            <StyledLink to="/intro/signup">
                                회원가입
                            </StyledLink>
                        </ModalSecondaryLinkRow>
                    </ModalBox>
                </ModalOverlay>
            )}
        </>
    );
};

export default Login;