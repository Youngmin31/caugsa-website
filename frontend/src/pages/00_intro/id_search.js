/**
 * 아이디 찾기
 * ===========
 * 이름 + 가입 때 쓴 포탈 아이디로 로그인 아이디를 찾아 준다.
 * 화면은 로그인/회원가입과 같은 카드 폼(components/form/AuthForm).
 */

import React, { useState } from "react";
import useApi from "../../hooks/api/axiosInterceptor";

import PageHeader from "../../components/board/PageHeader";
import {
    ButtonRow,
    Card,
    ErrorMessage,
    Form,
    FormGroup,
    HelpLink,
    HelpLinks,
    Input,
    Intro,
    Label,
    ResultBox,
    SecondaryLink,
    SubmitButton,
} from "../../components/form/AuthForm";

const IdSearch = () => {
    const [form, setForm] = useState({ name: "", portalId: "" });
    const [errors, setErrors] = useState({});
    const [result, setResult] = useState(null);
    const [isSearching, setIsSearching] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const newErrors = {};
        if (!form.name.trim()) newErrors.name = "이름을 입력해주세요";
        if (!form.portalId.trim()) newErrors.portalId = "가입 때 쓴 포탈 아이디를 입력해주세요";
        setErrors(newErrors);
        if (Object.keys(newErrors).length) return;

        setIsSearching(true);
        try {
            const response = await useApi.post("/auth/id_search", {
                name: form.name,
                portalId: form.portalId,
            });

            if (response.data.status === "SUCCESS") {
                setResult({ ok: true, userId: response.data.data.userId });
            } else {
                setResult({
                    ok: false,
                    message: response.data.message || "입력하신 정보와 맞는 아이디가 없습니다.",
                });
            }
        } catch (error) {
            console.error("아이디 찾기 오류:", error);
            setResult({ ok: false, message: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요." });
        } finally {
            setIsSearching(false);
        }
    };

    const reset = () => {
        setResult(null);
        setErrors({});
    };

    return (
        <>
            <PageHeader
                title="아이디 찾기"
                crumbs={[{ label: "Home", to: "/home" }, { label: "아이디 찾기" }]}
            />
            <Card>
                {result ? (
                    <Form as="div">
                        <ResultBox $ok={result.ok}>
                            {result.ok ? (
                                <>
                                    <p>
                                        <strong>{form.name}</strong> 회원님 반갑습니다.
                                    </p>
                                    <p>
                                        회원님의 아이디는 <strong>{result.userId}</strong> 입니다.
                                    </p>
                                </>
                            ) : (
                                <p>{result.message}</p>
                            )}
                        </ResultBox>

                        <ButtonRow>
                            <SecondaryLink as="button" type="button" onClick={reset}>
                                다시 찾기
                            </SecondaryLink>
                            <SecondaryLink to={result.ok ? "/intro/login" : "/intro/signup"}>
                                {result.ok ? "로그인" : "회원가입"}
                            </SecondaryLink>
                        </ButtonRow>
                    </Form>
                ) : (
                    <Form onSubmit={handleSubmit}>
                        <Intro>
                            가입할 때 입력한 이름과 포탈 아이디를 입력하세요.
                        </Intro>

                        <FormGroup>
                            <Label htmlFor="name">이름</Label>
                            <Input
                                type="text"
                                id="name"
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                placeholder="이름을 입력하세요"
                                autoComplete="name"
                            />
                            {errors.name && <ErrorMessage>{errors.name}</ErrorMessage>}
                        </FormGroup>

                        <FormGroup>
                            <Label htmlFor="portalId">포탈 아이디</Label>
                            <Input
                                type="text"
                                id="portalId"
                                name="portalId"
                                value={form.portalId}
                                onChange={handleChange}
                                placeholder="포탈 아이디를 입력하세요"
                                autoComplete="off"
                            />
                            {errors.portalId && <ErrorMessage>{errors.portalId}</ErrorMessage>}
                        </FormGroup>

                        <ButtonRow>
                            <SecondaryLink to="/intro/signup">회원가입</SecondaryLink>
                            <SubmitButton type="submit" disabled={isSearching}>
                                {isSearching ? "찾는 중…" : "아이디 찾기"}
                            </SubmitButton>
                        </ButtonRow>
                    </Form>
                )}

                <HelpLinks>
                    <HelpLink to="/intro/login">로그인</HelpLink>
                    <HelpLink to="/intro/login/pw-search">비밀번호 찾기</HelpLink>
                </HelpLinks>
            </Card>
        </>
    );
};

export default IdSearch;
