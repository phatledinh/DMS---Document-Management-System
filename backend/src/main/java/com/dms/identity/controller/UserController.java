package com.dms.identity.controller;

import com.dms.common.dto.ApiResponse;
import com.dms.identity.dto.UserResponse;
import com.dms.identity.service.UserService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/users")
public class UserController {
    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public ApiResponse<UserResponse> me() {
        return ApiResponse.success(userService.getCurrentUser());
    }

    @GetMapping
    public ApiResponse<java.util.List<UserResponse>> getAllUsers() {
        return ApiResponse.success(userService.getAllUsers());
    }
}
