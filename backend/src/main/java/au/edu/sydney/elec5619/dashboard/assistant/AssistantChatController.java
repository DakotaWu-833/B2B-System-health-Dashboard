package au.edu.sydney.elec5619.dashboard.assistant;

import au.edu.sydney.elec5619.dashboard.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/assistant/chat")
public class AssistantChatController {
    private final AssistantChatService chat;
    public AssistantChatController(AssistantChatService chat) { this.chat = chat; }
    @PostMapping public ApiResponse<AssistantChatService.Reply> reply(@Valid @RequestBody AssistantChatService.Request request, Authentication auth) {
        return ApiResponse.success(chat.reply(request, auth), "Contextual assistant response");
    }
}
