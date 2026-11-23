import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { useAuthApi } from "../../hooks/api/axiosInterceptor";
import { isValidPassword, PASSWORD_RULE_MESSAGE } from "../../utils/password";

const Wrapper = styled.div`
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
`;

const FormTable = styled.table`
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 30px;
`;

const TableRow = styled.tr`
    border-bottom: 1px solid #e0e0e0;
    
    &:first-child {
        border-top: 2px solid #666;
    }
`;

const TableHeader = styled.th`
    width: 30%;
    padding: 15px 10px;
    background-color: #f9f9f9;
    text-align: left;
    font-weight: 600;
`;

const TableCell = styled.td`
    padding: 15px 10px;
`;

const Input = styled.input`
    padding: 8px 12px;
    border: 1px solid #ddd;
    width: ${props => props.width || "100%"};
    max-width: ${props => props.maxWidth || "none"};
`;



const ButtonContainer = styled.div`
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-top: 40px;
    margin-bottom: 140px;
`;

const SubmitButton = styled.button`
    width: 100px;
    padding: 12px 25px;
    background-color: #2056ad;
    color: white;
    border: none;
    cursor: pointer;
    font-weight: 500;
    
    &:hover {
        background-color: #1a4786;
    }
`;

const ErrorMessage = styled.div`
    color: #e74c3c;
    font-size: 14px;
    margin-top: 5px;
`;

const PhoneContainer = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
`;

const HelpText = styled.span`
    font-size: 14px;
    color: #888;
    margin-left: 8px;
`;




const ModifyPersonalInfo = () => {
    const [userData, setUserData] = useState({
        name: '',
        userId: '',
        password: '',
        confirmPassword: '',
        phone1: '',
        phone2: '',
        phone3: '',
        email: '',
        backupEmail: ''
    });
    
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        // 사용자 데이터 로드
        const fetchUserData = async () => {
            try {
                setIsLoading(true);
                const response = await useAuthApi.get('/user/profile');
                
                if (response.data.result === 'SUCCESS') {
                    const data = response.data.data;
                    // 전화번호 분리 (백엔드에서 하나의 문자열로 제공한다고 가정)
                    const phoneNumber = data.phone || '';
                    const phoneNumbers = phoneNumber.split('-');
                    
                    setUserData({
                        name: data.name || '',
                        userId: data.userId || '',
                        password: '',
                        confirmPassword: '',
                        phone1: phoneNumbers[0] || '',
                        phone2: phoneNumbers[1] || '',
                        phone3: phoneNumbers[2] || '',
                        email: data.email || '',
                        backupEmail: data.backupEmail || ''
                    });
                } else {
                    console.error("사용자 데이터 로드 실패:", response.data.message);
                }
            } catch (error) {
                console.error("API 요청 오류:", error);
            } finally {
                setIsLoading(false);
            }
        };
        
        fetchUserData();
        
        // 컴포넌트 언마운트 시 이벤트 리스너 정리
        return () => {
        };
    }, []);
    
    const handleChange = (e) => {
        const { name, value } = e.target;
        setUserData(prevData => ({
            ...prevData,
            [name]: value
        }));
        
        // 에러 메시지 초기화
        if (errors[name]) {
            setErrors(prevErrors => ({
                ...prevErrors,
                [name]: ''
            }));
        }
    };
    
    const validateForm = () => {
        const newErrors = {};
        
        // 비밀번호 유효성 검사
        if (userData.password) {
            if (!isValidPassword(userData.password)) {
                newErrors.password = PASSWORD_RULE_MESSAGE;
            }
        } else {
            newErrors.password = '패스워드를 입력해주세요';
        }
        
        // 비밀번호 확인
        if (userData.password !== userData.confirmPassword) {
            newErrors.confirmPassword = '비밀번호가 일치하지 않습니다. 비밀번호를 다시 입력해주세요.';
        }
        
        // 주소 확인
        
        // 연락처 확인
        if (!userData.phone1 || !userData.phone2 || !userData.phone3) {
            newErrors.phone = '연락처를 입력해주세요';
        }
        
        // 이메일 확인
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    
    const handleSubmit = async () => {
        if (!validateForm()) {
            return;
        }
        
        try {
            const response = await useAuthApi.put('/user/profile', {
                password: userData.password,
                phone: `${userData.phone1}-${userData.phone2}-${userData.phone3}`,
                backupEmail: userData.backupEmail
            });
            
            if (response.data.result === 'SUCCESS') {
                alert('개인 정보가 성공적으로 수정되었습니다.');
            } else {
                alert(`정보 수정 실패: ${response.data.message}`);
            }
        } catch (error) {
            console.error("API 요청 오류:", error);
            alert('개인 정보 수정에 실패했습니다.');
        }
    };
    
    const handleCancel = () => {
        // 뒤로가기
        window.history.back();
    };
    
    if (isLoading) {
        return <Wrapper><p>로딩 중...</p></Wrapper>;
    }
    
    return (
        <Wrapper>
            <FormTable>
                <tbody>
                    <TableRow>
                        <TableHeader>이름</TableHeader>
                        <TableCell>{userData.name}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableHeader>회원아이디</TableHeader>
                        <TableCell>{userData.userId}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableHeader>비밀번호</TableHeader>
                        <TableCell>
                            <Input 
                                type="password" 
                                name="password" 
                                value={userData.password} 
                                onChange={handleChange} 
                                maxLength={20} 
                                maxWidth="300px"
                            />
                            <br />
                            <HelpText>영문, 숫자, 특수문자 포함 8~20자</HelpText>
                            {errors.password && <ErrorMessage>{errors.password}</ErrorMessage>}
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableHeader>비밀번호 재입력</TableHeader>
                        <TableCell>
                            <Input 
                                type="password" 
                                name="confirmPassword" 
                                value={userData.confirmPassword} 
                                onChange={handleChange} 
                                maxLength={20} 
                                maxWidth="300px"
                            />
                            {errors.confirmPassword && <ErrorMessage>{errors.confirmPassword}</ErrorMessage>}
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableHeader>연락처</TableHeader>
                        <TableCell>
                            <PhoneContainer>
                                <Input 
                                    type="text" 
                                    name="phone1" 
                                    value={userData.phone1} 
                                    onChange={handleChange} 
                                    maxLength={3} 
                                    width="70px"
                                />
                                <span>-</span>
                                <Input 
                                    type="text" 
                                    name="phone2" 
                                    value={userData.phone2} 
                                    onChange={handleChange} 
                                    maxLength={4} 
                                    width="70px"
                                />
                                <span>-</span>
                                <Input 
                                    type="text" 
                                    name="phone3" 
                                    value={userData.phone3} 
                                    onChange={handleChange} 
                                    maxLength={4} 
                                    width="70px"
                                />
                            </PhoneContainer>
                            {errors.phone && <ErrorMessage>{errors.phone}</ErrorMessage>}
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableHeader>포탈이메일</TableHeader>
                        <TableCell>
                            <Input
                                type="text"
                                name="email"
                                value={userData.email}
                                readOnly
                                disabled
                                width="200px"
                            />
                            <span>@cau.ac.kr</span>
                            <HelpText>계정을 식별하는 값이라 변경할 수 없습니다.</HelpText>
                        </TableCell>
                    </TableRow>
                    <TableRow>
                        <TableHeader>예비이메일</TableHeader>
                        <TableCell>
                            <Input 
                                type="text" 
                                name="backupEmail" 
                                value={userData.backupEmail} 
                                onChange={handleChange} 
                                width="200px" 
                                maxLength={50}
                            />
                        </TableCell>
                    </TableRow>
                </tbody>
            </FormTable>
            
            <ButtonContainer>
                <SubmitButton type="button" onClick={handleSubmit}>수정하기</SubmitButton>
            </ButtonContainer>
        </Wrapper>
    );
};

export default ModifyPersonalInfo;